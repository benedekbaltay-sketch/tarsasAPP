import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Pencil, 
  PlusCircle, 
  List, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  User, 
  Mail, 
  Phone,
  Users,
  Calendar,
  Filter
} from 'lucide-react';
import { 
  formatCurrency, 
  getCurrentFee, 
  getLatestFee,
  hasUpcomingFeeChange,
  getCombinedFlatLedgerTimeline,
  getBuildingAccounts
} from '../../utils/finances';
import { formatPhoneNumber } from '../../utils/phone';
import { TransactionFilterBar } from '../TransactionFilterBar';
import { initialFilterState, applyTransactionFilters, getActiveFilterCount } from '../../utils/filterUtils';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function FlatDetailModal({
  flatNum,
  isOpen,
  onClose,
  onOpenAddTx,
  onOpenFullscreen,
  onOpenEditTx,
  onOpenDeleteTx,
  isReadOnly = false
}) {
  const { state, t, updateFlatFees, copiedTx, copyTransaction, pasteTransaction, canUserManageBuilding } = useApp();
  const { flats, currentLang, currentUser, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSzvb = currentUser?.role === 'szvb';
  const isAuditor = currentUser?.role === 'auditor';

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings?.[0];
  const isEffectiveReadOnly = Boolean(
    isReadOnly ||
    !isAdmin ||
    isSzvb ||
    isAuditor ||
    (currentBuilding && canUserManageBuilding && !canUserManageBuilding(currentBuilding))
  );
  const allAccounts = getBuildingAccounts(currentBuilding);
  const customAccounts = allAccounts.filter(a => !a.isBaseAccount);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isTimelineEditMode, setIsTimelineEditMode] = useState(false);
  const [selectedTimelineId, setSelectedTimelineId] = useState(null);
  const [feeA, setFeeA] = useState('');
  const [feeB, setFeeB] = useState('');
  const [balA, setBalA] = useState('');
  const [balB, setBalB] = useState('');
  const [customFeesDraft, setCustomFeesDraft] = useState({});
  const [customBalsDraft, setCustomBalsDraft] = useState({});
  const [timelineFilters, setTimelineFilters] = useState(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Reset editing mode whenever modal closes or switches flat
  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
      setIsTimelineEditMode(false);
      setBalA('');
      setBalB('');
      setFeeA('');
      setFeeB('');
      setTimelineFilters(initialFilterState);
      setIsFilterOpen(false);
    }
  }, [isOpen, flatNum]);

  const handleClose = () => {
    setIsEditMode(false);
    setIsTimelineEditMode(false);
    setBalA('');
    setBalB('');
    setFeeA('');
    setFeeB('');
    setTimelineFilters(initialFilterState);
    setIsFilterOpen(false);
    onClose();
  };

  const backdropProps = useBackdropClose(handleClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
        if (isEffectiveReadOnly) return;
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedTimelineId && flatNum) {
          const raw = getCombinedFlatLedgerTimeline(flatNum, state);
          const currentTimeline = applyTransactionFilters(raw, timelineFilters);
          const itemToCopy = currentTimeline.find(it => it.id === selectedTimelineId);
          if (itemToCopy) {
            e.preventDefault();
            copyTransaction(itemToCopy);
          }
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
        if (selectedTimelineId && !isEffectiveReadOnly) {
          e.preventDefault();
          pasteTransaction(flatNum);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!flatNum) return;
        const raw = getCombinedFlatLedgerTimeline(flatNum, state);
        const currentTimeline = applyTransactionFilters(raw, timelineFilters);
        if (currentTimeline.length === 0) return;
        e.preventDefault();
        const idx = currentTimeline.findIndex(it => it.id === selectedTimelineId);
        if (e.key === 'ArrowDown') {
          if (idx === -1 || idx === currentTimeline.length - 1) {
            setSelectedTimelineId(currentTimeline[0].id);
          } else {
            setSelectedTimelineId(currentTimeline[idx + 1].id);
          }
        } else {
          if (idx <= 0) {
            setSelectedTimelineId(currentTimeline[currentTimeline.length - 1].id);
          } else {
            setSelectedTimelineId(currentTimeline[idx - 1].id);
          }
        }
      } else if (e.key === 'Delete') {
        if (window.getSelection && window.getSelection().toString().trim().length > 0) {
          return;
        }
        if (selectedTimelineId && flatNum && onOpenDeleteTx && !isEffectiveReadOnly) {
          const raw = getCombinedFlatLedgerTimeline(flatNum, state);
          const currentTimeline = applyTransactionFilters(raw, timelineFilters);
          const itemToDelete = currentTimeline.find(it => it.id === selectedTimelineId);
          if (itemToDelete) {
            e.preventDefault();
            const itType = itemToDelete.type || (itemToDelete.id?.startsWith('d-') ? 'Debit' : (itemToDelete.amount < 0 ? 'Debit' : 'Payment'));
            onOpenDeleteTx(itemToDelete.id, itType);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEffectiveReadOnly, selectedTimelineId, flatNum, state, timelineFilters, copyTransaction, pasteTransaction, onOpenDeleteTx]);

  // Deselect timeline item when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalClick = (e) => {
      const sel = window.getSelection ? window.getSelection().toString() : '';
      if (sel && sel.trim().length > 0) {
        return;
      }
      if (!e.target.closest('[data-timeline-item]')) {
        setSelectedTimelineId(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isOpen]);

  if (!isOpen || !flatNum || !(isAdmin || isSzvb || isAuditor)) return null;

  const flat = (flats || []).find(f => f.flatNum === flatNum) || {
    flatNum: flatNum,
    ownerName: "-",
    email: "-",
    tenantCount: 1,
    balance: 0,
    renovationBalance: 0,
    monthlyFee: 0,
    renovationFee: 0
  };

  const curFeeA = getCurrentFee(flat, 'KK');
  const curFeeB = getCurrentFee(flat, 'FA');
  const latestFeeA = getLatestFee(flat, 'KK');
  const latestFeeB = getLatestFee(flat, 'FA');
  const hasUpcomingA = hasUpcomingFeeChange(flat, 'KK');
  const hasUpcomingB = hasUpcomingFeeChange(flat, 'FA');
  const rawTimeline = getCombinedFlatLedgerTimeline(flatNum, state);
  const timeline = applyTransactionFilters(rawTimeline, timelineFilters);
  const activeTimelineFilterCount = getActiveFilterCount(timelineFilters);

  const startEditMode = () => {
    if (isEffectiveReadOnly) return;
    setBalA((flat.balance || 0).toString());
    setBalB((flat.renovationBalance || 0).toString());
    setFeeA(latestFeeA.toString());
    setFeeB(latestFeeB.toString());
    const initFees = {};
    const initBals = {};
    customAccounts.forEach(acc => {
      initBals[acc.id] = ((flat.customBalances && flat.customBalances[acc.id] !== undefined) ? flat.customBalances[acc.id] : 0).toString();
      if (acc.hasMonthlyFee) {
        initFees[acc.id] = (getCurrentFee(flat, acc.id) || Number(flat.customFees?.[acc.id]) || 0).toString();
      }
    });
    setCustomFeesDraft(initFees);
    setCustomBalsDraft(initBals);
    setIsEditMode(true);
  };

  const handleSaveFinances = (e) => {
    e.preventDefault();
    if (isEffectiveReadOnly) return;
    updateFlatFees(flatNum, feeA, feeB, balA, balB, customFeesDraft, customBalsDraft);
    setIsEditMode(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto overflow-x-hidden animate-fadeIn overscroll-contain cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden overflow-x-hidden my-auto overscroll-contain">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate font-display">
              {flat.flatNum}. {isEn ? "Flat Details" : "Lakás adatlap"}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isEffectiveReadOnly && onOpenAddTx && (
              <button
                onClick={() => onOpenAddTx(flat.flatNum)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isEn ? "New Item" : "Új tétel"}</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
              title={t.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Identity Bar */}
          {flat.owners && flat.owners.length > 1 ? (
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>{isEn ? "Owners" : "Tulajdonosok"} ({flat.owners.length} {isEn ? "persons" : "fő"})</span>
                </span>
                <span className="text-gray-500 text-xs">
                  {t.tenant_count}: <strong className="text-gray-800 font-bold">{flat.tenantCount || 1} {isEn ? "persons" : "fő"}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {flat.owners.map((owner, idx) => {
                  const ownerEmail = owner.email || (Array.isArray(owner.emails) ? owner.emails[0] : '');
                  const ownerPhone = owner.phone || (Array.isArray(owner.phones) ? owner.phones[0] : '');

                  return (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-200/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{owner.name}</span>
                        {owner.share && (
                          <span className="bg-blue-50 text-[#1E3A8A] font-bold px-1.5 py-0.5 rounded text-[10px] border border-blue-100">
                            {owner.share}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500 text-[11px] pt-1 border-t border-gray-50">
                        {ownerEmail && (
                          <a
                            href={`mailto:${ownerEmail}`}
                            className="flex items-center gap-1 text-gray-600 hover:text-[#1E3A8A] hover:underline truncate"
                            title={ownerEmail}
                          >
                            <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="truncate">{ownerEmail}</span>
                          </a>
                        )}

                        {ownerPhone && (
                          <a
                            href={`tel:${ownerPhone.replace(/\s+/g, '')}`}
                            className="flex items-center gap-1 text-gray-700 hover:text-[#1E3A8A] font-semibold"
                          >
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{formatPhoneNumber(ownerPhone)}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            (() => {
              const singleOwner = flat.owners?.[0];
              const singleEmail = singleOwner?.email || (Array.isArray(singleOwner?.emails) ? singleOwner.emails[0] : '') || flat.email || '';
              const singlePhone = singleOwner?.phone || (Array.isArray(singleOwner?.phones) ? singleOwner.phones[0] : '') || flat.phone || '';

              return (
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      {t.owner_name}
                    </span>
                    <span className="font-bold text-gray-900 text-sm">{flat.ownerName}</span>
                  </div>

                  {singleEmail && (
                    <>
                      <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                          {t.email}
                        </span>
                        <a
                          href={`mailto:${singleEmail}`}
                          className="font-semibold text-gray-700 hover:text-[#1E3A8A]"
                        >
                          {singleEmail}
                        </a>
                      </div>
                    </>
                  )}

                  {singlePhone && (
                    <>
                      <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                          {t.phone}
                        </span>
                        <a
                          href={`tel:${singlePhone.replace(/\s+/g, '')}`}
                          className="font-semibold text-gray-700 hover:text-[#1E3A8A]"
                        >
                          {formatPhoneNumber(singlePhone)}
                        </a>
                      </div>
                    </>
                  )}

                  <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      {t.tenant_count}
                    </span>
                    <span className="font-semibold text-gray-700">{flat.tenantCount || 1} {isEn ? "persons" : "fő"}</span>
                  </div>
                </div>
              );
            })()
          )}

          {/* Balances & Monthly Fees Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-700 font-display">
                {isEn ? "Balances & Monthly Fees" : "Egyenlegek és havi előírások"}
              </span>
              {isAdmin && !isEffectiveReadOnly && !isEditMode && (
                <button
                  type="button"
                  onClick={startEditMode}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  title={isEn ? "Modify balances and monthly fees" : "Egyenlegek és havi előírások módosítása"}
                >
                  <Pencil className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>{isEn ? "Modify" : "Módosítás"}</span>
                </button>
              )}
            </div>

            {!isEditMode ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
                  <span className="text-[11px] font-medium text-gray-500 block">{t.current_kk_balance}</span>
                  <span className={`text-base font-extrabold font-display ${flat.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(flat.balance || 0)}
                  </span>
                </div>
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
                  <span className="text-[11px] font-medium text-gray-500 block">{t.current_fa_balance}</span>
                  <span className={`text-base font-extrabold font-display ${flat.renovationBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(flat.renovationBalance || 0)}
                  </span>
                </div>
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-gray-500 truncate">{t.monthly_kk_fee}</span>
                      {hasUpcomingA && (
                        <span className="text-[9px] font-bold bg-blue-100 text-[#1E3A8A] px-1.5 py-0.5 rounded shrink-0">
                          {isEn ? "Next mo." : "Köv. hótól"}
                        </span>
                      )}
                    </div>
                    <span className="text-base font-extrabold text-[#1E3A8A] font-display block mt-0.5">
                      {formatCurrency(latestFeeA)}
                    </span>
                  </div>
                  {hasUpcomingA && latestFeeA !== curFeeA && (
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {isEn ? `Current: ${formatCurrency(curFeeA)}` : `Most még: ${formatCurrency(curFeeA)}`}
                    </span>
                  )}
                </div>
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-gray-500 truncate">{t.monthly_fa_fee}</span>
                      {hasUpcomingB && (
                        <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">
                          {isEn ? "Next mo." : "Köv. hótól"}
                        </span>
                      )}
                    </div>
                    <span className="text-base font-extrabold text-purple-700 font-display block mt-0.5">
                      {formatCurrency(latestFeeB)}
                    </span>
                  </div>
                  {hasUpcomingB && latestFeeB !== curFeeB && (
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {isEn ? `Current: ${formatCurrency(curFeeB)}` : `Most még: ${formatCurrency(curFeeB)}`}
                    </span>
                  )}
                </div>

                {customAccounts.map(acc => {
                  const bal = (flat.customBalances && flat.customBalances[acc.id] !== undefined)
                    ? flat.customBalances[acc.id]
                    : ((flat.customBalances && flat.customBalances[acc.name] !== undefined) ? flat.customBalances[acc.name] : 0);
                  const fee = getCurrentFee(flat, acc.id) || Number(flat.customFees?.[acc.id]) || 0;

                  return (
                    <React.Fragment key={acc.id}>
                      <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
                        <span className="text-[11px] font-medium text-gray-500 block truncate">{acc.name} {isEn ? "Balance" : "egyenleg"}</span>
                        <span className={`text-base font-extrabold font-display ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatCurrency(bal)}
                        </span>
                      </div>
                      {acc.hasMonthlyFee && (
                        <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3 flex flex-col justify-between">
                          <div>
                            <span className="text-[11px] font-medium text-gray-500 truncate block">{acc.name} {isEn ? "Fee" : "előírás"}</span>
                            <span className="text-base font-extrabold text-emerald-800 font-display block mt-0.5">
                              {formatCurrency(fee)}
                            </span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={handleSaveFinances} className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{isEn ? "Modify Balances & Monthly Fees" : "Egyenlegek és havi előírások módosítása"}</span>
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* KK Current Balance (Debt / Overpayment) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {isEn ? "Current KK Balance (Ft)" : "Aktuális KK egyenleg (Ft)"}
                    </label>
                    <input
                      type="number"
                      value={balA}
                      onChange={(e) => setBalA(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      step="1"
                      placeholder="pl. 0 vagy -15000"
                      required
                    />
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {isEn ? "Negative (-) = Debt, Positive (+) = Overpayment" : "Negatív (-) = Tartozás, Pozitív (+) = Túlfizetés"}
                    </span>
                  </div>

                  {/* FA Current Balance (Debt / Overpayment) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {isEn ? "Current FA Balance (Ft)" : "Aktuális FA egyenleg (Ft)"}
                    </label>
                    <input
                      type="number"
                      value={balB}
                      onChange={(e) => setBalB(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      step="1"
                      placeholder="pl. 0 vagy 5000"
                      required
                    />
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {isEn ? "Negative (-) = Debt, Positive (+) = Overpayment" : "Negatív (-) = Tartozás, Pozitív (+) = Túlfizetés"}
                    </span>
                  </div>

                  {/* KK Monthly Fee */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {t.monthly_kk_fee} (Ft)
                    </label>
                    <input
                      type="number"
                      value={feeA}
                      onChange={(e) => setFeeA(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      min="0"
                      step="1"
                      placeholder="pl. 15000"
                      required
                    />
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {feeA !== '' && Number(feeA) !== curFeeA
                        ? (isEn ? `Previous: ${formatCurrency(curFeeA)} → New: ${formatCurrency(Number(feeA) || 0)}` : `Módosítás előtt: ${formatCurrency(curFeeA)} → Új: ${formatCurrency(Number(feeA) || 0)}`)
                        : (isEn ? `Current fee: ${formatCurrency(curFeeA)}` : `Jelenlegi havi előírás: ${formatCurrency(curFeeA)}`)}
                    </span>
                  </div>

                  {/* FA Monthly Fee */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {t.monthly_fa_fee} (Ft)
                    </label>
                    <input
                      type="number"
                      value={feeB}
                      onChange={(e) => setFeeB(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                      min="0"
                      step="1"
                      placeholder="pl. 10000"
                      required
                    />
                    <span className="text-[10px] text-gray-500 block mt-1">
                      {feeB !== '' && Number(feeB) !== curFeeB
                        ? (isEn ? `Previous: ${formatCurrency(curFeeB)} → New: ${formatCurrency(Number(feeB) || 0)}` : `Módosítás előtt: ${formatCurrency(curFeeB)} → Új: ${formatCurrency(Number(feeB) || 0)}`)
                        : (isEn ? `Current fee: ${formatCurrency(curFeeB)}` : `Jelenlegi havi előírás: ${formatCurrency(curFeeB)}`)}
                    </span>
                  </div>

                  {customAccounts.map(acc => (
                    <React.Fragment key={acc.id}>
                      {/* Custom Account Balance */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          {acc.name} {isEn ? "Current Balance (Ft)" : "Aktuális egyenleg (Ft)"}
                        </label>
                        <input
                          type="number"
                          value={customBalsDraft[acc.id] ?? ''}
                          onChange={(e) => setCustomBalsDraft(prev => ({ ...prev, [acc.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                          step="1"
                          placeholder="pl. 0 vagy -5000"
                        />
                        <span className="text-[10px] text-gray-500 block mt-1">
                          {isEn ? "Negative (-) = Debt, Positive (+) = Overpayment" : "Negatív (-) = Tartozás, Pozitív (+) = Túlfizetés"}
                        </span>
                      </div>

                      {/* Custom Account Monthly Fee (if enabled) */}
                      {acc.hasMonthlyFee && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            {acc.name} {isEn ? "Monthly Fee (Ft)" : "Havi előírás (Ft)"}
                          </label>
                          <input
                            type="number"
                            value={customFeesDraft[acc.id] ?? ''}
                            onChange={(e) => setCustomFeesDraft(prev => ({ ...prev, [acc.id]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
                            min="0"
                            step="1"
                            placeholder="pl. 5000"
                          />
                          <span className="text-[10px] text-gray-500 block mt-1">
                            {isEn ? "Monthly prescribed assessment" : "Havi rendszeres előírás összege"}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="px-3.5 py-1.5 border border-gray-300 bg-white rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-lg text-xs font-bold hover:bg-[#1e40af] transition-colors cursor-pointer shadow-xs"
                  >
                    {t.save}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Ledger Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white w-full min-w-0">
            <div className="p-3 sm:px-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-800 font-display truncate">
                  {t.tx_and_fees_title}
                </span>
                <span className="text-[11px] font-bold text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded-full shrink-0">
                  {timeline.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Filter Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isFilterOpen || activeTimelineFilterCount > 0
                      ? 'bg-blue-50 border border-blue-300 text-[#1E3A8A] shadow-xs'
                      : 'border border-gray-200 bg-white hover:bg-gray-100 text-gray-600'
                  }`}
                  title={isEn ? "Filter by date, account (KK/FA), and amount" : "Szűrés dátum, KK/FA számla és összeg szerint"}
                >
                  <Filter className="w-3 h-3" />
                  <span>{isEn ? "Filter" : "Szűrés"}</span>
                  {activeTimelineFilterCount > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#1E3A8A] text-white text-[9px] font-bold flex items-center justify-center -mr-0.5">
                      {activeTimelineFilterCount}
                    </span>
                  )}
                </button>

                {isAdmin && !isEffectiveReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsTimelineEditMode(!isTimelineEditMode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isTimelineEditMode 
                        ? 'bg-amber-100 border border-amber-300 text-amber-900 shadow-xs' 
                        : 'border border-gray-200 bg-white hover:bg-gray-100 text-gray-600'
                    }`}
                    title={isTimelineEditMode ? "Szerkesztési mód befejezése" : "Tételek szerkesztése és törlése"}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{isTimelineEditMode ? (isEn ? "Done" : "Kész") : (isEn ? "Manage" : "Kezelés")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expandable Filter Panel */}
            <TransactionFilterBar
              filters={timelineFilters}
              onFilterChange={setTimelineFilters}
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              isEn={isEn}
              mode="flat"
              totalCount={rawTimeline.length}
              resultCount={timeline.length}
            />

            {/* Empty state */}
            {timeline.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                {isEn ? "No records" : "Nincs rögzített tétel"}
              </div>
            ) : (
              <>
                {/* Desktop table view (sm+) */}
                <div className="hidden sm:block overflow-x-hidden">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead className="bg-gray-50/70 text-gray-500 font-semibold border-b border-gray-100">
                      <tr>
                        <th className="py-2.5 px-3.5 w-24">{t.th_date}</th>
                        <th className="py-2.5 px-2 w-14">Számla</th>
                        <th className="py-2.5 px-3 min-w-0">{t.th_comment}</th>
                        <th className="py-2.5 px-3 text-right w-28">{t.th_amount}</th>
                        <th className="py-2.5 px-3 text-right w-28">{t.th_balance}</th>
                        {!isEffectiveReadOnly && <th className="py-2.5 px-2 text-center w-20">Művelet</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {timeline.slice(0, 3).map((item) => {
                        const isDebit = item.type === "Debit";
                        const isNegative = isDebit || (item.amount < 0);
                        const isKK = item.targetAccount === "Közös Költség" || item.account === "Közös Költség";
                        const itemType = item.type || (item.id?.startsWith('d-') ? 'Debit' : (isNegative ? 'Debit' : 'Payment'));
                        const isSelected = selectedTimelineId === item.id;

                        const isZero = Math.abs(Math.round(item.amount || 0)) === 0;

                        return (
                          <tr 
                            key={item.id} 
                            data-timeline-item="true"
                            onClick={() => {
                              const sel = window.getSelection ? window.getSelection().toString() : '';
                              if (sel && sel.trim().length > 0) return;
                              setSelectedTimelineId(item.id);
                            }}
                            onDoubleClick={() => onOpenEditTx && onOpenEditTx(item.id, itemType, false)}
                            className={`transition-colors cursor-pointer select-text ${
                              isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50/70'
                            }`}
                            title={isEn ? "Double click to view details" : "Dupla kattintás a részletek megtekintéséhez"}
                          >
                            <td className="py-2.5 px-3.5 font-mono text-gray-500 text-[11px] whitespace-nowrap select-text cursor-text">{item.date}</td>
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isKK ? 'bg-blue-50 text-[#1E3A8A] border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                              }`}>
                                {isKK ? 'KK' : 'FA'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-800 truncate font-medium select-text cursor-text" title={item.comment}>
                              <span className="truncate block select-text cursor-text">{item.comment}</span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap select-text cursor-text ${isZero ? 'text-gray-600' : (isNegative ? 'text-red-600' : 'text-emerald-600')}`}>
                              {isZero ? '' : (isNegative ? '-' : '+')}{Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-gray-500 whitespace-nowrap text-[11px] select-text cursor-text">
                              {formatCurrency(item.runningBalance)}
                            </td>
                            {!isEffectiveReadOnly && (
                              <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                {isTimelineEditMode ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenEditTx && onOpenEditTx(item.id, itemType, true);
                                      }}
                                      className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                      title="Szerkesztés"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDeleteTx && onOpenDeleteTx(item.id, itemType);
                                      }}
                                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      title="Törlés"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list view (< sm) */}
                <div className="sm:hidden divide-y divide-gray-100 overflow-x-hidden">
                  {timeline.slice(0, 3).map((item) => {
                    const isDebit = item.type === "Debit";
                    const isNegative = isDebit || (item.amount < 0);
                    const isKK = item.targetAccount === "Közös Költség" || item.account === "Közös Költség";
                    const itemType = item.type || (item.id?.startsWith('d-') ? 'Debit' : (isNegative ? 'Debit' : 'Payment'));
                    const isSelected = selectedTimelineId === item.id;
                    const isZero = Math.abs(Math.round(item.amount || 0)) === 0;

                    return (
                      <div 
                        key={item.id} 
                        data-timeline-item="true"
                        onClick={() => {
                          const sel = window.getSelection ? window.getSelection().toString() : '';
                          if (sel && sel.trim().length > 0) return;
                          setSelectedTimelineId(item.id);
                        }}
                        onDoubleClick={() => onOpenEditTx && onOpenEditTx(item.id, itemType, false)}
                        className={`p-3 transition-colors space-y-1.5 cursor-pointer select-text ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50/70'
                        }`}
                        title={isEn ? "Double click to view details" : "Dupla kattintás a részletek megtekintéséhez"}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isKK ? 'bg-blue-50 text-[#1E3A8A] border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'
                            }`}>
                              {isKK ? 'KK' : 'FA'}
                            </span>
                            <span className="text-xs font-bold text-gray-900 truncate select-text cursor-text" title={item.comment}>
                              {item.comment}
                            </span>
                          </div>
                          <span className={`text-xs font-bold whitespace-nowrap shrink-0 select-text cursor-text ${isZero ? 'text-gray-600' : (isNegative ? 'text-red-600' : 'text-emerald-600')}`}>
                            {isZero ? '' : (isNegative ? '-' : '+')}{Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                          <span className="font-mono text-gray-400 select-text cursor-text">{item.date}</span>
                          <div className="flex items-center gap-2 select-text cursor-text">
                            <span>Egyenleg: <strong className="text-gray-700">{formatCurrency(item.runningBalance)}</strong></span>
                            {isTimelineEditMode && !isEffectiveReadOnly && (
                              <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-gray-200">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenEditTx && onOpenEditTx(item.id, itemType, true);
                                  }}
                                  className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                  title="Szerkesztés"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDeleteTx && onOpenDeleteTx(item.id, itemType);
                                  }}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                  title="Törlés"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Bottom Action: Full history */}
            {timeline.length > 3 && (
              <div className="p-3 bg-gray-50/80 border-t border-gray-200 text-center">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenFullscreen('flat', flat.flatNum);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-white hover:bg-gray-100 text-[#1E3A8A] border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Minden tranzakció, szűrés és letöltés"
                >
                  <span>{t.all_items}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
}
