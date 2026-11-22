import React, { useState, useMemo, useEffect } from 'react';
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
  List,
  ChevronRight,
  Maximize2,
  ExternalLink,
  Shield,
  Filter,
  Minus,
  Calendar
} from 'lucide-react';
import { 
  formatCurrency, 
  getBuildingReserve, 
  getBuildingRenovationFund, 
  getBuildingAccountReserve,
  getBuildingAccounts,
  getMonthlyStats,
  translateCategory,
  getCurrentFee
} from '../utils/finances';
import { exportTransactionsToExcel } from '../utils/exportExcel';
import { TransactionFilterBar } from '../components/TransactionFilterBar';
import { initialFilterState, applyTransactionFilters, getActiveFilterCount } from '../utils/filterUtils';
import { StickyMonthSection } from '../components/StickyMonthGroup';
import { groupItemsByMonth } from '../utils/dateGrouping';

export function AdminView({
  onBackToPortfolio,
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
  onOpenFullscreenTx,
  onNavigateToCase,
  onOpenAssembly,
  onOpenLoans,
  onOpenCalendar
}) {
  const { state, t, toggleGridEditMode, copiedTx, copyTransaction, pasteTransaction } = useApp();
  const { flats, transactions, expenses, isGridEditMode, currentLang } = state;
  const isEn = currentLang === 'en';

  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [isTxEditMode, setIsTxEditMode] = useState(false);
  const [txFilters, setTxFilters] = useState(initialFilterState);
  const [isTxFilterOpen, setIsTxFilterOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [flatViewMode, setFlatViewMode] = useState('list');

  // Map of linked cases per transaction/expense id: { [txId]: { tile, item } }
  const linkedCaseMap = useMemo(() => {
    const map = {};
    const tiles = state.infoSections || [];
    for (const tile of tiles) {
      for (const it of (tile.items || [])) {
        if (Array.isArray(it.linkedTxIds)) {
          for (const txId of it.linkedTxIds) {
            map[txId] = { tile, item: it };
          }
        }
      }
    }
    return map;
  }, [state.infoSections]);

  // Building and accounts
  const currentBuilding = (state.buildings || []).find(b => b.id === state.currentBuildingId) || state.buildings?.[0];
  const allAccounts = getBuildingAccounts(currentBuilding);
  const customAccounts = allAccounts.filter(a => !a.isBaseAccount);
  const kkAccount = allAccounts.find(a => a.id === 'KK');
  const faAccount = allAccounts.find(a => a.id === 'FA');
  const kkShort = kkAccount?.shortName || 'KK';
  const faShort = faAccount?.shortName || 'FA';

  // Financial indicators
  const buildingReserveKK = getBuildingReserve(state);
  const buildingReserveFA = getBuildingRenovationFund(state);

  // Calculate total arrears (sum of negative balances across all flats and all accounts)
  const totalArrears = (flats || []).reduce((acc, f) => {
    let sum = 0;
    if ((f.balance || 0) < 0) sum += Math.abs(f.balance);
    if ((f.renovationBalance || 0) < 0) sum += Math.abs(f.renovationBalance);
    customAccounts.forEach(cAcc => {
      const cBal = f.customBalances?.[cAcc.id] || 0;
      if (cBal < 0) sum += Math.abs(cBal);
    });
    return acc + sum;
  }, 0);

  const now = new Date();
  const monthlyStats = getMonthlyStats(now.getFullYear(), now.getMonth() + 1, state);

  // Robust date parser for sorting
  const parseItemDate = (d) => {
    if (!d) return 0;
    if (typeof d === 'string') {
      const clean = d.replace(/\./g, '-').trim();
      const t = new Date(clean).getTime();
      return isNaN(t) ? 0 : t;
    }
    return new Date(d).getTime() || 0;
  };

  // Combine transactions and expenses for the list
  const combinedTxList = [
    ...(transactions || [])
      .filter(t => t.type !== "Correction")
      .map(t => ({
        ...t,
        itemType: 'Transaction',
        isExpense: false,
        dateVal: parseItemDate(t.date)
      })),
    ...(expenses || [])
      .map(e => ({
        ...e,
        itemType: 'Expense',
        isExpense: true,
        flatNum: 'Kiadás',
        dateVal: parseItemDate(e.date)
      }))
  ];

  combinedTxList.sort((a, b) => {
    const diff = b.dateVal - a.dateVal;
    if (diff !== 0) return diff;
    return (b.id || '').localeCompare(a.id || '');
  });

  const postFilterTxList = applyTransactionFilters(combinedTxList, txFilters);

  const filteredTxList = postFilterTxList.filter(item => {
    if (!txSearchQuery.trim()) return true;
    const q = txSearchQuery.toLowerCase();
    return (
      (item.date && item.date.toLowerCase().includes(q)) ||
      (item.flatNum && item.flatNum.toLowerCase().includes(q)) ||
      (item.targetAccount && item.targetAccount.toLowerCase().includes(q)) ||
      (item.provider && item.provider.toLowerCase().includes(q)) ||
      (item.comment && item.comment.toLowerCase().includes(q)) ||
      (item.amount !== undefined && item.amount !== null && item.amount.toString().includes(q))
    );
  });

  const activeTxFilterCount = getActiveFilterCount(txFilters);
  const displayTxList = (txSearchQuery || activeTxFilterCount > 0) ? filteredTxList : filteredTxList.slice(0, 8);

  const groupedTxList = useMemo(() => {
    return groupItemsByMonth(displayTxList, isEn);
  }, [displayTxList, isEn]);

  const handleExportExcel = () => {
    exportTransactionsToExcel(transactions, expenses, isEn);
  };

  // Keyboard copy/paste for dashboard transactions
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if focus is inside an input, textarea or if any modal is active
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      if (document.querySelector('.fixed.inset-0.z-')) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedTxId) {
          const itemToCopy = displayTxList.find(it => it.id === selectedTxId);
          if (itemToCopy) {
            e.preventDefault();
            copyTransaction(itemToCopy);
          }
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
        if (selectedTxId) {
          e.preventDefault();
          pasteTransaction(null);
        }
      } else if (e.key === 'ArrowDown') {
        if (displayTxList.length === 0) return;
        e.preventDefault();
        const idx = displayTxList.findIndex(it => it.id === selectedTxId);
        if (idx === -1 || idx === displayTxList.length - 1) {
          setSelectedTxId(displayTxList[0].id);
        } else {
          setSelectedTxId(displayTxList[idx + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        if (displayTxList.length === 0) return;
        e.preventDefault();
        const idx = displayTxList.findIndex(it => it.id === selectedTxId);
        if (idx <= 0) {
          setSelectedTxId(displayTxList[displayTxList.length - 1].id);
        } else {
          setSelectedTxId(displayTxList[idx - 1].id);
        }
      } else if (e.key === 'Delete') {
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedTxId && onOpenDeleteTxConfirm) {
          const itemToDelete = displayTxList.find(it => it.id === selectedTxId);
          if (itemToDelete) {
            e.preventDefault();
            onOpenDeleteTxConfirm(itemToDelete.id, itemToDelete.isExpense ? 'Expense' : 'Payment');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTxId, displayTxList, copyTransaction, pasteTransaction, onOpenDeleteTxConfirm]);

  // Deselect transaction item when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const sel = window.getSelection ? window.getSelection().toString() : '';
      if (sel && sel.trim().length > 0) {
        return;
      }
      if (!e.target.closest('[data-admin-tx-item]')) {
        setSelectedTxId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
      
      {/* 1. Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Card 1: Building Reserves (Unified single edit button & dynamic accounts) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
          {/* Card Header with unified edit button */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>{t.kpi_reserves_title || (isEn ? "Bank Accounts & Reserves" : "Folyószámlák és Tartalékok")}</span>
            </span>
            <button
              onClick={onOpenGlobalBalances}
              className="p-1.5 px-2.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
              title={isEn ? "Edit bank balances" : "Folyószámlák és tartalékok szerkesztése"}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 space-y-3 pt-3">
            {/* KK */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider block mb-0.5">
                  {t.kpi_building_reserve}
                </span>
                <span className={`text-2xl font-black font-display ${buildingReserveKK >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(buildingReserveKK)}
                </span>
              </div>
            </div>

            {/* FA */}
            <div className="pt-3 flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-0.5">
                  {t.kpi_renovation_fund}
                </span>
                <span className={`text-2xl font-black font-display ${buildingReserveFA >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                  {formatCurrency(buildingReserveFA)}
                </span>
              </div>
            </div>

            {/* Custom accounts */}
            {customAccounts.map(acc => {
              const reserve = getBuildingAccountReserve(acc.id, state);
              return (
                <div key={acc.id} className="pt-3 flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
                      {acc.name}
                    </span>
                    <span className={`text-2xl font-black font-display ${reserve >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatCurrency(reserve)}
                    </span>
                  </div>
                </div>
              );
            })}
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

          <div className="border-t border-gray-100 pt-3.5 mt-3.5 flex items-center gap-2">
            <button
              onClick={() => onOpenAddTransaction()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isEn ? "+ Record New Item" : "+ Új tétel rögzítése"}</span>
            </button>
            {onOpenCalendar && (
              <button
                onClick={onOpenCalendar}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] font-bold text-xs rounded-xl border border-blue-200 transition-all cursor-pointer"
                title={isEn ? "Building Calendar & Deadlines" : "Ház naptára és eseményei"}
              >
                <Calendar className="w-4 h-4" />
                <span>{isEn ? "Calendar" : "Naptár"}</span>
              </button>
            )}
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-gray-500" />
              <h3 className="text-base font-bold text-gray-900 font-display">
                {t.admin_arrears_title}
              </h3>
            </div>

            {/* View Switcher: List vs Grid */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setFlatViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  flatViewMode === 'list'
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
                onClick={() => setFlatViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  flatViewMode === 'grid'
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpenAddTransaction()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? "+ Record New Item" : "+ Új tétel rögzítése"}</span>
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

        {flatViewMode === 'list' ? (
          /* List / Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">{t.flat_col_unit || (isEn ? "Unit / Flat" : "Albetét / Lakás")}</th>
                  <th className="py-3 px-4">{t.flat_col_owner || (isEn ? "Owner" : "Tulajdonos")}</th>
                  <th className="py-3 px-4 text-right">{kkShort} {isEn ? "Bal." : "egyenleg"}</th>
                  <th className="py-3 px-4 text-right">{faShort} {isEn ? "Bal." : "egyenleg"}</th>
                  {customAccounts.map(acc => (
                    <th key={acc.id} className="py-3 px-4 text-right" title={acc.name}>
                      {acc.shortName || acc.name} {isEn ? "Bal." : "egyenleg"}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">{t.flat_col_total_balance || (isEn ? "Total Balance" : "Összegyenleg")}</th>
                  <th className="py-3 px-4 text-center">{t.flat_col_quick_pay || (isEn ? "Quick Pay" : "Gyorsbefizetés")}</th>
                  <th className="py-3 px-4 text-right">{t.portfolio_col_actions || (isEn ? "Actions" : "Műveletek")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(flats || []).map((flat) => {
                  const customSum = customAccounts.reduce((sum, acc) => sum + (flat.customBalances?.[acc.id] || 0), 0);
                  const totalBalance = (flat.balance || 0) + (flat.renovationBalance || 0) + customSum;
                  const hasArrears = (flat.balance || 0) < 0 || (flat.renovationBalance || 0) < 0 || customAccounts.some(acc => (flat.customBalances?.[acc.id] || 0) < 0);

                  const oneMonthKK = getCurrentFee(flat, 'KK') > 0 ? getCurrentFee(flat, 'KK') : (Number(flat.monthlyFee) || 0);
                  const oneMonthFA = getCurrentFee(flat, 'FA') > 0 ? getCurrentFee(flat, 'FA') : (Number(flat.renovationFee) || 0);
                  const customPayAccounts = customAccounts.filter(acc => acc.hasMonthlyFee);

                  return (
                    <tr
                      key={flat.flatNum}
                      onClick={() => onOpenFlatDetail(flat.flatNum)}
                      className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${
                        hasArrears ? 'bg-red-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Flat unit */}
                      <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasArrears ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span>{flat.flatNum}. {isEn ? "Flat" : "lakás"}</span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                        <span className="truncate max-w-[180px] block" title={flat.ownerName}>
                          {flat.ownerName || '-'}
                        </span>
                        {flat.tenantName && (
                          <span className="text-[10px] text-gray-400 block truncate max-w-[180px]">
                            {isEn ? "Tenant: " : "Bérlő: "}{flat.tenantName}
                          </span>
                        )}
                      </td>

                      {/* KK Balance */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-medium font-mono">
                        <span className={(flat.balance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}>
                          {formatCurrency(flat.balance || 0)}
                        </span>
                      </td>

                      {/* FA Balance */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-medium font-mono">
                        <span className={(flat.renovationBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}>
                          {formatCurrency(flat.renovationBalance || 0)}
                        </span>
                      </td>

                      {/* Custom Balances */}
                      {customAccounts.map(acc => {
                        const bal = flat.customBalances?.[acc.id] || 0;
                        return (
                          <td key={acc.id} className="py-3 px-4 text-right whitespace-nowrap font-medium font-mono">
                            <span className={bal < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}>
                              {formatCurrency(bal)}
                            </span>
                          </td>
                        );
                      })}

                      {/* Total Balance pill */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          totalBalance < 0 
                            ? 'bg-red-100 text-red-700 border border-red-200' 
                            : totalBalance > 0 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {formatCurrency(totalBalance)}
                        </span>
                      </td>

                      {/* Quick Pay */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'KK', oneMonthKK)}
                            className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] text-[11px] font-bold transition-colors cursor-pointer"
                            title={`1 havi ${kkShort} befizetés (${formatCurrency(oneMonthKK)})`}
                          >
                            +{kkShort}
                          </button>
                          <button
                            onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'FA', oneMonthFA)}
                            className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-colors cursor-pointer"
                            title={`1 havi ${faShort} befizetés (${formatCurrency(oneMonthFA)})`}
                          >
                            +{faShort}
                          </button>
                          {customPayAccounts.map(acc => {
                            const oneMonthCustom = getCurrentFee(flat, acc.id) > 0 ? getCurrentFee(flat, acc.id) : (Number(flat.customFees?.[acc.id]) || 0);
                            const accShort = acc.shortName || (acc.name?.length > 5 ? acc.name.slice(0, 4) : acc.name);
                            return (
                              <button
                                key={acc.id}
                                onClick={() => onOpenQuickPayConfirm(flat.flatNum, acc.name, oneMonthCustom)}
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                                title={`1 havi ${acc.name} (${accShort}) befizetés (${formatCurrency(oneMonthCustom)})`}
                              >
                                +{accShort}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isGridEditMode ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onOpenEditFlatMaster(state.currentBuildingId, flat.flatNum)}
                              className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                              title={isEn ? "Edit master data" : "Törzsadatok szerkesztése"}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onOpenDeleteFlatConfirm(flat.flatNum)}
                              className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                              title={isEn ? "Delete flat" : "Lakás törlése"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onOpenFlatDetail(flat.flatNum)}
                            className="p-1 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors"
                            title={isEn ? "View flat details" : "Lakás részletei"}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tile Grid */
          <div className="p-4 sm:p-6 bg-[#F3F4F6]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(flats || []).map((flat) => {
                const customSum = customAccounts.reduce((sum, acc) => sum + (flat.customBalances?.[acc.id] || 0), 0);
                const totalBalance = (flat.balance || 0) + (flat.renovationBalance || 0) + customSum;
                const hasArrears = (flat.balance || 0) < 0 || (flat.renovationBalance || 0) < 0 || customAccounts.some(acc => (flat.customBalances?.[acc.id] || 0) < 0);

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
                        <span className="text-gray-500">{kkShort} egyenleg:</span>
                        <strong className={flat.balance < 0 ? 'text-red-600' : 'text-gray-900'}>
                          {formatCurrency(flat.balance || 0)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">{faShort} egyenleg:</span>
                        <strong className={flat.renovationBalance < 0 ? 'text-red-600' : 'text-gray-900'}>
                          {formatCurrency(flat.renovationBalance || 0)}
                        </strong>
                      </div>
                      {customAccounts.map(acc => {
                        const bal = flat.customBalances?.[acc.id] || 0;
                        return (
                          <div key={acc.id} className="flex justify-between items-center">
                            <span className="text-gray-500 truncate mr-2" title={acc.name}>
                              {acc.shortName || acc.name} egyenleg:
                            </span>
                            <strong className={bal < 0 ? 'text-red-600 flex-shrink-0' : 'text-gray-900 flex-shrink-0'}>
                              {formatCurrency(bal)}
                            </strong>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick pay buttons */}
                    {(() => {
                      const oneMonthKK = getCurrentFee(flat, 'KK') > 0 ? getCurrentFee(flat, 'KK') : (Number(flat.monthlyFee) || 0);
                      const oneMonthFA = getCurrentFee(flat, 'FA') > 0 ? getCurrentFee(flat, 'FA') : (Number(flat.renovationFee) || 0);
                      const customPayAccounts = customAccounts.filter(acc => acc.hasMonthlyFee);

                      return (
                        <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-gray-100 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'KK', oneMonthKK)}
                            className="flex-1 min-w-[48px] py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] text-[11px] font-bold transition-colors cursor-pointer text-center"
                            title={`1 havi ${kkShort} befizetés (${formatCurrency(oneMonthKK)})`}
                          >
                            +{kkShort}
                          </button>
                          <button
                            onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'FA', oneMonthFA)}
                            className="flex-1 min-w-[48px] py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-colors cursor-pointer text-center"
                            title={`1 havi ${faShort} befizetés (${formatCurrency(oneMonthFA)})`}
                          >
                            +{faShort}
                          </button>
                          {customPayAccounts.map(acc => {
                            const oneMonthCustom = getCurrentFee(flat, acc.id) > 0 ? getCurrentFee(flat, acc.id) : (Number(flat.customFees?.[acc.id]) || 0);
                            const accShort = acc.shortName || (acc.name?.length > 5 ? acc.name.slice(0, 4) : acc.name);
                            return (
                              <button
                                key={acc.id}
                                onClick={() => onOpenQuickPayConfirm(flat.flatNum, acc.name, oneMonthCustom)}
                                className="flex-1 min-w-[48px] py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer text-center truncate px-1"
                                title={`1 havi ${acc.name} (${accShort}) befizetés (${formatCurrency(oneMonthCustom)})`}
                              >
                                +{accShort}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 4. All Transactions & Expenses Table (Revolut style) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white">
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

            {/* Filter Toggle Button */}
            <button
              onClick={() => setIsTxFilterOpen(!isTxFilterOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                isTxFilterOpen || activeTxFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] shadow-xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={isEn ? "Filter by date, fund (KK/FA), and amount" : "Szűrés dátum, KK/FA számla és összeg szerint"}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{isEn ? "Filter" : "Szűrés"}</span>
              {activeTxFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold flex items-center justify-center -mr-0.5">
                  {activeTxFilterCount}
                </span>
              )}
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

        {/* Expandable Filter Panel */}
        <TransactionFilterBar
          filters={txFilters}
          onFilterChange={setTxFilters}
          isOpen={isTxFilterOpen}
          onClose={() => setIsTxFilterOpen(false)}
          isEn={isEn}
          mode="global"
          totalCount={combinedTxList.length}
          resultCount={filteredTxList.length}
        />

        {/* Transactions Modern List */}
        <div className="divide-y divide-gray-100">
          {groupedTxList.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {isEn ? "No records found" : "Nem található tranzakció"}
            </div>
          ) : (
            groupedTxList.map((group, groupIdx) => (
              <StickyMonthSection
                key={group.key}
                monthKey={group.key}
                label={group.monthKey}
                topOffset="page"
                isFirst={groupIdx === 0}
              >
                {group.items.map((item) => {
                  const isExpense = item.isExpense;
                  const isNegative = isExpense || (item.amount < 0);
                  const isZero = Math.abs(Math.round(item.amount || 0)) === 0;
                  const isKK = item.targetAccount === "Közös Költség";
                  const isSelected = selectedTxId === item.id;

                  let displayName;
                  if (isExpense) {
                    if (item.title && item.title.trim()) {
                      displayName = item.title.trim();
                    } else if (item.comment && item.comment.trim()) {
                      displayName = item.comment.trim();
                    } else if (item.provider && item.provider !== 'Közös Költség' && item.provider !== 'Felújítási Alap') {
                      displayName = item.provider;
                    } else {
                      displayName = translateCategory(item.category, isEn) || (isEn ? "Expense" : "Kiadás");
                    }
                  } else {
                    displayName = (item.flatNum === 'Global' || item.flatNum === 'Egyéb' || !item.flatNum)
                      ? (item.title?.trim() || item.comment?.trim() || (isEn ? "Condominium" : "Társasház"))
                      : `${item.flatNum}. lakás`;
                  }

                  return (
                    <div
                      key={item.id}
                      data-admin-tx-item="true"
                      onClick={() => {
                        const sel = window.getSelection ? window.getSelection().toString() : '';
                        if (sel && sel.trim().length > 0) return;
                        setSelectedTxId(item.id);
                      }}
                      onDoubleClick={() => onOpenEditTx && onOpenEditTx(item.id, isExpense ? 'Expense' : 'Payment', false)}
                      className={`p-4 transition-all flex items-center justify-between gap-4 cursor-pointer select-text ${
                        isSelected
                          ? 'bg-blue-50/70'
                          : 'hover:bg-gray-50/70'
                      }`}
                      title={isEn ? "Double click to view details" : "Dupla kattintás a részletek megtekintéséhez"}
                    >
                      {/* Left: Icon & Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isZero ? 'bg-gray-100 text-gray-500' : (isNegative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')
                        }`}>
                          {isZero ? <Minus className="w-5 h-5" /> : (isNegative ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 truncate select-text cursor-text">
                              {displayName}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isKK ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isKK ? 'KK' : 'FA'}
                            </span>
                            {(() => {
                              const linkedCase = linkedCaseMap[item.id];
                              if (!linkedCase) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToCase?.(linkedCase.tile.id, linkedCase.item.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 transition-colors cursor-pointer"
                                  title={`Ugrás a kapcsolódó ügyhöz: ${linkedCase.item.title || 'Ügy'} (${linkedCase.tile.title})`}
                                >
                                  <Shield className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                                  <span className="truncate max-w-[120px] sm:max-w-[180px]">Ügy: {linkedCase.item.title || 'Kárügy'}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                                </button>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 truncate select-text cursor-text">
                            <span>{item.date}</span>
                            {isExpense ? (
                              <>
                                {item.comment && item.comment.trim() && item.comment.trim() !== displayName && (
                                  <span> &bull; {item.comment.trim()}</span>
                                )}
                                {item.category && translateCategory(item.category, isEn) !== displayName && (
                                  <span className="text-gray-400"> ({translateCategory(item.category, isEn)})</span>
                                )}
                              </>
                            ) : (
                              <>
                                {item.comment && item.comment.trim() !== displayName && (
                                  <span> &bull; {item.comment.trim()}</span>
                                )}
                                {item.category && (
                                  <span className="text-gray-400"> &bull; {translateCategory(item.category, isEn)}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right select-text cursor-text">
                          <div className={`text-sm font-bold font-display ${isZero ? 'text-gray-600' : (isNegative ? 'text-red-600' : 'text-emerald-600')}`}>
                            {isZero ? '' : (isNegative ? '-' : '+')}{Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft
                          </div>
                          {(() => {
                            const m = item.paymentMethod || item.method;
                            const isCash = m === 'Cash' || m === 'Készpénz' || m === 'Cash (Register)' || m === 'Készpénz (Pénztár)';
                            if (isCash) {
                              return (
                                <div className="mt-0.5">
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] leading-tight">
                                    {isEn ? "Cash (Register)" : "Készpénz (Pénztár)"}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {translateCategory(m || 'Bank Transfer', isEn)}
                              </div>
                            );
                          })()}
                        </div>

                        {isTxEditMode && (
                          <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditTx(item.id, isExpense ? 'Expense' : 'Payment', true);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="Szerkesztés"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDeleteTxConfirm(item.id, isExpense ? 'Expense' : 'Payment');
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Törlés"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </StickyMonthSection>
            ))
          )}
        </div>

        {/* View all transactions footer */}
        {filteredTxList.length > 8 && (
          <div className="p-3 sm:p-4 border-t border-gray-100 flex items-center justify-center bg-gray-50/50">
            <button
              onClick={() => onOpenFullscreenTx('global')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{t.all_items}</span>
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
