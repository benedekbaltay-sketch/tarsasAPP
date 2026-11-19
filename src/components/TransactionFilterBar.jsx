import React, { useState } from 'react';
import { 
  Filter, 
  SlidersHorizontal, 
  Calendar, 
  X, 
  RotateCcw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Banknote,
  Coins
} from 'lucide-react';
import { 
  initialFilterState, 
  getActiveFilterCount, 
  computeQuickDateRange, 
  getActiveFilterPills 
} from '../utils/filterUtils';

export function TransactionFilterBar({
  filters,
  onFilterChange,
  isOpen,
  onClose,
  isEn = false,
  mode = 'global', // 'global' | 'flat'
  totalCount,
  resultCount
}) {
  const activeCount = getActiveFilterCount(filters);
  const activePills = getActiveFilterPills(filters, isEn, mode);

  // Local state to toggle custom date inputs visibility if user wants manual range
  const [showCustomDate, setShowCustomDate] = useState(() => {
    return Boolean(filters?.dateFrom || filters?.dateTo) && (!filters?.quickDate || filters?.quickDate === 'custom');
  });

  const handleFieldChange = (field, value) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  const handleReset = () => {
    onFilterChange(initialFilterState);
    setShowCustomDate(false);
  };

  const handleRemovePill = (field) => {
    if (field === 'date') {
      onFilterChange({
        ...filters,
        dateFrom: '',
        dateTo: '',
        quickDate: 'all'
      });
      setShowCustomDate(false);
    } else if (field === 'amount') {
      onFilterChange({
        ...filters,
        minAmount: '',
        maxAmount: ''
      });
    } else if (field === 'type') {
      onFilterChange({
        ...filters,
        type: 'all'
      });
    } else if (field === 'account') {
      onFilterChange({
        ...filters,
        account: 'all'
      });
    }
  };

  // Quick Date Presets
  const handleSelectQuickDate = (preset) => {
    if (preset === 'all') {
      onFilterChange({
        ...filters,
        dateFrom: '',
        dateTo: '',
        quickDate: 'all'
      });
      setShowCustomDate(false);
    } else if (preset === 'custom') {
      setShowCustomDate(true);
      onFilterChange({
        ...filters,
        quickDate: 'custom'
      });
    } else {
      const { dateFrom, dateTo } = computeQuickDateRange(preset);
      onFilterChange({
        ...filters,
        dateFrom,
        dateTo,
        quickDate: preset
      });
    }
  };

  // Quick Amount Presets
  const handleSelectQuickAmount = (preset) => {
    if (preset === 'all') {
      onFilterChange({
        ...filters,
        minAmount: '',
        maxAmount: ''
      });
    } else if (preset === 'under20k') {
      onFilterChange({
        ...filters,
        minAmount: '',
        maxAmount: '20000'
      });
    } else if (preset === '20k-50k') {
      onFilterChange({
        ...filters,
        minAmount: '20000',
        maxAmount: '50000'
      });
    } else if (preset === 'over50k') {
      onFilterChange({
        ...filters,
        minAmount: '50000',
        maxAmount: ''
      });
    }
  };

  // Determine current amount preset
  const isAmountAll = !filters.minAmount && !filters.maxAmount;
  const isUnder20k = filters.minAmount === '' && String(filters.maxAmount) === '20000';
  const is20k50k = String(filters.minAmount) === '20000' && String(filters.maxAmount) === '50000';
  const isOver50k = String(filters.minAmount) === '50000' && !filters.maxAmount;

  // Determine active quickDate
  const currentQuickDate = filters.quickDate || (
    !filters.dateFrom && !filters.dateTo ? 'all' : 'custom'
  );

  // 1. COLLAPSED VIEW WITH ACTIVE FILTERS: Sleek minimal pill bar
  if (!isOpen) {
    if (activeCount === 0) return null;

    return (
      <div className="bg-blue-50/60 border-b border-blue-100/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-fadeIn select-none">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-[#1E3A8A]" />
            {isEn ? "Filters:" : "Aktív szűrők:"}
          </span>

          {activePills.map(pill => (
            <span
              key={pill.id}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs border transition-colors ${
                pill.color === 'emerald'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : pill.color === 'rose'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : pill.color === 'blue'
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : pill.color === 'purple'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : pill.color === 'indigo'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span>{pill.label}</span>
              <button
                type="button"
                onClick={() => handleRemovePill(pill.field)}
                className="hover:opacity-75 p-0.5 rounded-full cursor-pointer ml-0.5"
                title={isEn ? "Remove filter" : "Szűrő törlése"}
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 font-semibold px-2 py-0.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer ml-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isEn ? "Clear all" : "Minden szűrő törlése"}</span>
          </button>
        </div>

        {resultCount !== undefined && (
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>
              <strong>{resultCount}</strong> {isEn ? "results" : "találat"}
              {totalCount !== undefined && totalCount !== resultCount ? ` (${isEn ? "out of" : "összesen"} ${totalCount})` : ''}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. EXPANDED VIEW: Complete minimalist, professional filter center
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm p-4 sm:p-6 animate-fadeIn select-none space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center shadow-2xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 font-display">
              {isEn ? "Filter Conditions" : "Szűrési feltételek"}
            </h4>
          </div>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
              {activeCount} {isEn ? "active" : "aktív"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isEn ? "Reset all" : "Alaphelyzet"}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title={isEn ? "Close filter panel" : "Szűrősáv bezárása"}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Filter Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Left Column: Type (Jelleg) & Account (Számla) */}
        <div className="space-y-4">
          {/* 1. Transaction Type */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              {isEn ? "Transaction Type" : "Típus / Tranzakció jellege"}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 border border-gray-200 rounded-xl">
              <button
                type="button"
                onClick={() => handleFieldChange('type', 'all')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  !filters.type || filters.type === 'all'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                {isEn ? "All" : "Mind"}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('type', 'income')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  filters.type === 'income'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>{mode === 'flat' ? (isEn ? "Payments" : "Befizetések") : (isEn ? "Income" : "Bevételek")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('type', 'expense')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  filters.type === 'expense'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                }`}
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>{mode === 'flat' ? (isEn ? "Charges" : "Előírások") : (isEn ? "Expenses" : "Kiadások")}</span>
              </button>
            </div>
          </div>

          {/* 2. Account / Fund */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              {isEn ? "Account / Fund" : "Számla / Alap"}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-50 border border-gray-200 rounded-xl">
              <button
                type="button"
                onClick={() => handleFieldChange('account', 'all')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  !filters.account || filters.account === 'all'
                    ? 'bg-[#1E3A8A] text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                {isEn ? "All Accounts" : "Mind"}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('account', 'KK')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filters.account === 'KK'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>KK</span>
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('account', 'FA')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  filters.account === 'FA'
                    ? 'bg-purple-600 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>FA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Date (Időszak) & Amount (Összeg) */}
        <div className="space-y-4">
          {/* 3. Period (Időszak) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#1E3A8A]" />
                <span>{isEn ? "Period" : "Időszak"}</span>
              </label>

              {(filters.dateFrom || filters.dateTo) && (
                <button
                  type="button"
                  onClick={() => handleRemovePill('date')}
                  className="text-[10px] text-gray-400 hover:text-red-600 cursor-pointer"
                >
                  {isEn ? "Clear dates" : "Dátumok törlése"}
                </button>
              )}
            </div>

            {/* Quick date presets */}
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                { id: 'all', label: isEn ? "All Time" : "Összes" },
                { id: 'thisMonth', label: isEn ? "This Month" : "Ez a hónap" },
                { id: 'last30Days', label: isEn ? "Last 30D" : "30 nap" },
                { id: 'last3Months', label: isEn ? "Last 3M" : "3 hó" },
                { id: 'thisYear', label: isEn ? "This Year" : "Idei év" },
                { id: 'custom', label: isEn ? "Custom..." : "Egyedi..." }
              ].map(preset => {
                const isSelected = currentQuickDate === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectQuickDate(preset.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium ${
                      isSelected
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers */}
            {(showCustomDate || currentQuickDate === 'custom' || filters.dateFrom || filters.dateTo) && (
              <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
                <div className="relative">
                  <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">{isEn ? "From" : "Kezdő dátum (tól)"}</span>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => {
                      setShowCustomDate(true);
                      onFilterChange({
                        ...filters,
                        dateFrom: e.target.value,
                        quickDate: 'custom'
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white font-medium text-gray-800 transition-colors"
                  />
                </div>
                <div className="relative">
                  <span className="text-[10px] font-semibold text-gray-400 block mb-0.5">{isEn ? "To" : "Záró dátum (ig)"}</span>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => {
                      setShowCustomDate(true);
                      onFilterChange({
                        ...filters,
                        dateTo: e.target.value,
                        quickDate: 'custom'
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white font-medium text-gray-800 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Amount Range (Összeg) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#1E3A8A]" />
                <span>{isEn ? "Amount Range" : "Összegtartomány"}</span>
              </label>

              {(filters.minAmount !== '' || filters.maxAmount !== '') && (
                <button
                  type="button"
                  onClick={() => handleRemovePill('amount')}
                  className="text-[10px] text-gray-400 hover:text-red-600 cursor-pointer"
                >
                  {isEn ? "Clear amount" : "Összeg törlése"}
                </button>
              )}
            </div>

            {/* Quick amount presets */}
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                type="button"
                onClick={() => handleSelectQuickAmount('all')}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium ${
                  isAmountAll
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs font-bold'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {isEn ? "All" : "Bármennyi"}
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickAmount('under20k')}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium ${
                  isUnder20k
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs font-bold'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                &lt; 20 000 Ft
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickAmount('20k-50k')}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium ${
                  is20k50k
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs font-bold'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                20k – 50k Ft
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickAmount('over50k')}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium ${
                  isOver50k
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs font-bold'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                &gt; 50 000 Ft
              </button>
            </div>

            {/* Custom Min / Max inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="number"
                  placeholder={isEn ? "Min amount" : "Min. összeg"}
                  value={filters.minAmount !== undefined && filters.minAmount !== null ? filters.minAmount : ''}
                  onChange={(e) => handleFieldChange('minAmount', e.target.value)}
                  className="w-full pl-2.5 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white font-medium text-gray-800 transition-colors"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none font-bold">
                  Ft
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder={isEn ? "Max amount" : "Max. összeg"}
                  value={filters.maxAmount !== undefined && filters.maxAmount !== null ? filters.maxAmount : ''}
                  onChange={(e) => handleFieldChange('maxAmount', e.target.value)}
                  className="w-full pl-2.5 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white font-medium text-gray-800 transition-colors"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none font-bold">
                  Ft
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar: Matching count & Quick Close */}
      <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {resultCount !== undefined && (
            <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-semibold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                <strong>{resultCount}</strong> {isEn ? "matching items" : "tétel felel meg a szűrésnek"}
                {totalCount !== undefined ? ` (${totalCount} ${isEn ? "total" : "összesből"})` : ''}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? "Reset" : "Alaphelyzet"}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isEn ? "Apply & Close" : "Alkalmazás & Bezárás"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
