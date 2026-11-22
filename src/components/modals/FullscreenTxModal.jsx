import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  X, 
  Download, 
  Pencil, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft,
  ExternalLink,
  Shield,
  Receipt,
  Filter,
  Minus
} from 'lucide-react';
import { 
  formatCurrency, 
  getCombinedFlatLedgerTimeline, 
  translateCategory 
} from '../../utils/finances';
import { 
  exportTransactionsToExcel, 
  exportTimelineToExcel 
} from '../../utils/exportExcel';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { TransactionFilterBar } from '../TransactionFilterBar';
import { initialFilterState, applyTransactionFilters, getActiveFilterCount } from '../../utils/filterUtils';
import { StickyMonthSection } from '../StickyMonthGroup';
import { groupItemsByMonth } from '../../utils/dateGrouping';

export function FullscreenTxModal({
  isOpen,
  type, // 'global' | 'flat'
  flatNum,
  onClose,
  onOpenEditTx,
  onOpenDeleteTx,
  onNavigateToCase
}) {
  const { state, t, copiedTx, copyTransaction, pasteTransaction } = useApp();
  const { transactions, expenses, currentLang } = state;
  const isEn = currentLang === 'en';
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  const canViewAllFlats = isAdmin || state.currentUser?.role === 'szvb';
  const effectiveFlatNum = canViewAllFlats ? flatNum : state.currentUser?.flatNum;

  const [query, setQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [filters, setFilters] = useState(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      setIsEditMode(false);
      setQuery('');
      setFilters(initialFilterState);
      setIsFilterOpen(false);
      setSelectedId(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsEditMode(false);
    setQuery('');
    setFilters(initialFilterState);
    setIsFilterOpen(false);
    onClose();
  };

  // Map of linked cases per transaction/expense id: { [txId]: { tile, item } }
  const linkedCaseMap = useMemo(() => {
    if (!isOpen) return {};
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
  }, [isOpen, state.infoSections]);

  const items = useMemo(() => {
    if (!isOpen) return [];
    if (type === 'flat' && effectiveFlatNum) {
      return getCombinedFlatLedgerTimeline(effectiveFlatNum, state);
    }
    // Robust date parser
    const parseItemDate = (d) => {
      if (!d) return 0;
      if (typeof d === 'string') {
        const clean = d.replace(/\./g, '-').trim();
        const t = new Date(clean).getTime();
        return isNaN(t) ? 0 : t;
      }
      return new Date(d).getTime() || 0;
    };

    // Global transactions + expenses
    const tx = (transactions || [])
      .filter(t => t.type !== "Correction")
      .map(t => ({
        ...t,
        itemType: 'Transaction',
        isExpense: false,
        dateVal: parseItemDate(t.date)
      }));
    const exp = (expenses || [])
      .map(e => ({
        ...e,
        itemType: 'Expense',
        isExpense: true,
        flatNum: 'Kiadás',
        dateVal: parseItemDate(e.date)
      }));
    const list = [...tx, ...exp];
    list.sort((a, b) => {
      const diff = b.dateVal - a.dateVal;
      if (diff !== 0) return diff;
      return (b.id || '').localeCompare(a.id || '');
    });
    return list;
  }, [isOpen, type, flatNum, transactions, expenses, state]);

  const postFilterItems = useMemo(() => {
    if (!isOpen) return [];
    return applyTransactionFilters(items, filters);
  }, [isOpen, items, filters]);

  const activeFilterCount = useMemo(() => {
    return getActiveFilterCount(filters);
  }, [filters]);

  const filteredItems = useMemo(() => {
    if (!isOpen) return [];
    return postFilterItems.filter(item => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (item.date && item.date.toLowerCase().includes(q)) ||
        (item.flatNum && item.flatNum.toLowerCase().includes(q)) ||
        (item.account && item.account.toLowerCase().includes(q)) ||
        (item.targetAccount && item.targetAccount.toLowerCase().includes(q)) ||
        (item.provider && item.provider.toLowerCase().includes(q)) ||
        (item.comment && item.comment.toLowerCase().includes(q)) ||
        (item.amount !== undefined && item.amount !== null && item.amount.toString().includes(q))
      );
    });
  }, [isOpen, postFilterItems, query]);

  const groupedItems = useMemo(() => {
    return groupItemsByMonth(filteredItems, isEn);
  }, [filteredItems, isEn]);

  const handleExport = () => {
    if (type === 'flat' && effectiveFlatNum) {
      exportTimelineToExcel(items, effectiveFlatNum, isEn);
    } else {
      exportTransactionsToExcel(transactions, expenses, isEn);
    }
  };

  // Keyboard navigation and copy/paste handling (Ctrl+C, Ctrl+V, ArrowUp, ArrowDown)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't intercept if focus is inside an input or textarea
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
        if (!isAdmin) return;
        // If user highlighted text on page, let browser copy text
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedId) {
          const itemToCopy = filteredItems.find(it => it.id === selectedId);
          if (itemToCopy) {
            e.preventDefault();
            copyTransaction(itemToCopy);
          }
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
        if (!isAdmin) return;
        e.preventDefault();
        const targetFlat = type === 'flat' ? effectiveFlatNum : null;
        pasteTransaction(targetFlat);
      } else if (e.key === 'ArrowDown') {
        if (filteredItems.length === 0) return;
        e.preventDefault();
        const idx = filteredItems.findIndex(it => it.id === selectedId);
        if (idx === -1 || idx === filteredItems.length - 1) {
          setSelectedId(filteredItems[0].id);
        } else {
          setSelectedId(filteredItems[idx + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        if (filteredItems.length === 0) return;
        e.preventDefault();
        const idx = filteredItems.findIndex(it => it.id === selectedId);
        if (idx <= 0) {
          setSelectedId(filteredItems[filteredItems.length - 1].id);
        } else {
          setSelectedId(filteredItems[idx - 1].id);
        }
      } else if (e.key === 'Delete') {
        if (!isAdmin) return;
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedId && onOpenDeleteTx) {
          const itemToDelete = filteredItems.find(it => it.id === selectedId);
          if (itemToDelete) {
            e.preventDefault();
            const itType = itemToDelete.itemType || (itemToDelete.isExpense ? 'Expense' : (itemToDelete.id?.startsWith('d-') ? 'Debit' : (itemToDelete.amount < 0 ? 'Debit' : 'Payment')));
            onOpenDeleteTx(itemToDelete.id, itType);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAdmin, selectedId, filteredItems, type, effectiveFlatNum, copyTransaction, pasteTransaction, onOpenDeleteTx]);

  // Deselect item when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalClick = (e) => {
      const sel = window.getSelection ? window.getSelection().toString() : '';
      if (sel && sel.trim().length > 0) {
        return;
      }
      if (!e.target.closest('[data-fullscreen-tx-item]')) {
        setSelectedId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isOpen]);

  if (!isOpen || !state.currentUser) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={handleClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Website Logo -> Back to Home */}
          <div className="flex items-center justify-start flex-1 min-w-0">
            <NavLogoButton onClick={handleClose} />
          </div>

          {/* Center: Current Interface Name */}
          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {type === 'flat' ? `${flatNum}. ${isEn ? "Flat History" : "lakás előzményei"}` : t.admin_all_tx_title}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {filteredItems.length} {isEn ? "records" : "tétel"}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Actions (Filter, Edit mode & Excel) */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] shadow-xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={isEn ? "Filter by date, account (KK/FA), and amount" : "Szűrés dátum, KK/FA számla és összeg szerint"}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEn ? "Filter" : "Szűrés"}</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold flex items-center justify-center -mr-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  isEditMode ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.edit}</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 bg-white cursor-pointer transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-2.5">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search_fullscreen_placeholder}
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Filter Panel */}
      <TransactionFilterBar
        filters={filters}
        onFilterChange={setFilters}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        isEn={isEn}
        mode={type === 'flat' ? 'flat' : 'global'}
        totalCount={items.length}
        resultCount={filteredItems.length}
      />

      {/* Content List */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain">
        <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100">
          {groupedItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {isEn ? "No records found" : "Nem található tétel"}
            </div>
          ) : (
            groupedItems.map((group, groupIdx) => (
              <StickyMonthSection
                key={group.key}
                monthKey={group.key}
                label={group.monthKey}
                topOffset="modal"
                isFirst={groupIdx === 0}
              >
                {group.items.map((item) => {
                  const isExpense = item.isExpense || item.type === "Debit";
                  const isNegative = isExpense || (item.amount < 0);
                  const isZero = Math.abs(Math.round(item.amount || 0)) === 0;
                  const isKK = (item.account || item.targetAccount) === "Közös Költség";
                  const isSelected = selectedId === item.id;

                  let itemTitle;
                  if (type === 'flat') {
                    itemTitle = item.type === "Debit"
                      ? (item.title?.trim() || item.comment?.trim() || (isEn ? "Debit" : "Előírás"))
                      : (isEn ? "Payment" : "Befizetés");
                  } else if (item.isExpense) {
                    if (item.title && item.title.trim()) {
                      itemTitle = item.title.trim();
                    } else if (item.comment && item.comment.trim()) {
                      itemTitle = item.comment.trim();
                    } else if (item.provider && item.provider !== 'Közös Költség' && item.provider !== 'Felújítási Alap') {
                      itemTitle = item.provider;
                    } else {
                      itemTitle = translateCategory(item.category, isEn) || (isEn ? "Expense" : "Kiadás");
                    }
                  } else {
                    itemTitle = (item.flatNum === 'Global' || item.flatNum === 'Egyéb' || !item.flatNum)
                      ? (item.title?.trim() || item.comment?.trim() || (isEn ? "Condominium" : "Társasház"))
                      : `${item.flatNum}. lakás`;
                  }

                  return (
                    <div
                      key={item.id}
                      data-fullscreen-tx-item="true"
                      onClick={() => {
                        const sel = window.getSelection ? window.getSelection().toString() : '';
                        if (sel && sel.trim().length > 0) return;
                        setSelectedId(item.id);
                      }}
                      onDoubleClick={() => onOpenEditTx && onOpenEditTx(item.id, item.itemType || (item.isExpense ? 'Expense' : (item.id?.startsWith('d-') ? 'Debit' : (item.amount < 0 ? 'Debit' : 'Payment'))), false)}
                      className={`p-4 transition-all flex items-center justify-between gap-4 cursor-pointer select-text ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50/70'}
                      `}
                      title={isEn ? "Double click to view details" : "Dupla kattintás a részletek megtekintéséhez"}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isZero ? 'bg-gray-100 text-gray-500' : (isNegative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')
                        }`}>
                          {isZero ? <Minus className="w-5 h-5" /> : (isNegative ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 truncate select-text cursor-text">
                              {itemTitle}
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
                                    onClose?.();
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
                            {item.isExpense ? (
                              <>
                                {item.comment && item.comment.trim() && item.comment.trim() !== itemTitle && (
                                  <span> • {item.comment.trim()}</span>
                                )}
                                {item.category && translateCategory(item.category, isEn) !== itemTitle && (
                                  <span className="text-gray-400"> ({translateCategory(item.category, isEn)})</span>
                                )}
                              </>
                            ) : (
                              <>
                                {item.comment && item.comment.trim() !== itemTitle && (
                                  <span> • {item.comment.trim()}</span>
                                )}
                                {item.category && (
                                  <span className="text-gray-400"> • {translateCategory(item.category, isEn)}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right select-text cursor-text">
                          <div className={`text-sm font-bold font-display ${isZero ? 'text-gray-600' : (isNegative ? 'text-red-600' : 'text-emerald-600')}`}>
                            {isZero ? '' : (isNegative ? '-' : '+')}{Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft
                          </div>
                          {item.runningBalance !== undefined ? (
                            <div className="text-[11px] text-gray-400">
                              Egyenleg: {formatCurrency(item.runningBalance)}
                            </div>
                          ) : (
                            (() => {
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
                            })()
                          )}
                        </div>

                        {isEditMode && (
                          <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsEditMode(false);
                                onOpenEditTx(item.id, item.itemType || (item.isExpense ? 'Expense' : (item.id?.startsWith('d-') ? 'Debit' : (item.amount < 0 ? 'Debit' : 'Payment'))), true);
                              }}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="Szerkesztés"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDeleteTx(item.id, item.itemType || (item.isExpense ? 'Expense' : (item.id?.startsWith('d-') ? 'Debit' : (item.amount < 0 ? 'Debit' : 'Payment'))));
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
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
        </div>
      </div>
    </div>
  );
}
