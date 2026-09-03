import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ArrowLeft, 
  Search, 
  X, 
  Download, 
  Pencil, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { 
  formatCurrency, 
  getCombinedFlatLedgerTimeline 
} from '../../utils/finances';
import { 
  exportTransactionsToExcel, 
  exportTimelineToExcel 
} from '../../utils/exportExcel';

export function FullscreenTxModal({
  isOpen,
  type, // 'global' | 'flat'
  flatNum,
  onClose,
  onOpenEditTx,
  onOpenDeleteTx
}) {
  const { state, t } = useApp();
  const { transactions, expenses, currentLang } = state;
  const isEn = currentLang === 'en';

  const [query, setQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  if (!isOpen) return null;

  let items = [];
  if (type === 'flat' && flatNum) {
    items = getCombinedFlatLedgerTimeline(flatNum, state);
  } else {
    // Global transactions + expenses
    const tx = (transactions || []).map(t => ({
      ...t,
      itemType: 'Transaction',
      isExpense: false,
      dateVal: new Date(t.date || 0)
    }));
    const exp = (expenses || []).map(e => ({
      ...e,
      itemType: 'Expense',
      isExpense: true,
      flatNum: 'Kiadás',
      dateVal: new Date(e.date || 0)
    }));
    items = [...tx, ...exp];
    items.sort((a, b) => b.dateVal - a.dateVal);
  }

  const filteredItems = items.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (item.date && item.date.toLowerCase().includes(q)) ||
      (item.flatNum && item.flatNum.toLowerCase().includes(q)) ||
      (item.account && item.account.toLowerCase().includes(q)) ||
      (item.targetAccount && item.targetAccount.toLowerCase().includes(q)) ||
      (item.provider && item.provider.toLowerCase().includes(q)) ||
      (item.comment && item.comment.toLowerCase().includes(q)) ||
      (item.amount && item.amount.toString().includes(q))
    );
  });

  const handleExport = () => {
    if (type === 'flat' && flatNum) {
      exportTimelineToExcel(items, flatNum, isEn);
    } else {
      exportTransactionsToExcel(transactions, expenses, isEn);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900 font-display">
              {type === 'flat' ? `${flatNum}. ${isEn ? "Flat History" : "lakás előzményei"}` : t.admin_all_tx_title}
            </h2>
            <span className="text-xs text-gray-500">
              {filteredItems.length} {isEn ? "records" : "tétel"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {type === 'global' && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer ${
                isEditMode ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.edit}</span>
            </button>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
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

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {isEn ? "No records found" : "Nem található tétel"}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpense = item.isExpense || item.type === "Debit";
              const isKK = (item.account || item.targetAccount) === "Közös Költség";

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-gray-50/70 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isExpense ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {type === 'flat' 
                            ? (item.type === "Debit" ? (isEn ? "Debit" : "Előírás") : (isEn ? "Payment" : "Befizetés"))
                            : (item.isExpense ? item.provider || item.category : `${item.flatNum}. lakás`)}
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

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-bold font-display ${isExpense ? 'text-gray-900' : 'text-emerald-600'}`}>
                        {formatCurrency(item.amount)}
                      </div>
                      {item.runningBalance !== undefined && (
                        <div className="text-[11px] text-gray-400">
                          Egyenleg: {formatCurrency(item.runningBalance)}
                        </div>
                      )}
                    </div>

                    {isEditMode && type === 'global' && (
                      <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                        <button
                          onClick={() => onOpenEditTx(item.id, item.isExpense ? 'Expense' : 'Payment')}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Szerkesztés"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenDeleteTx(item.id, item.isExpense ? 'Expense' : 'Payment')}
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
      </div>
    </div>
  );
}
