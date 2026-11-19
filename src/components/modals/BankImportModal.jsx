import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  ArrowRight, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  Building2, 
  ArrowLeft,
  ExternalLink,
  Info,
  RefreshCw
} from 'lucide-react';
import { parseBankFile, matchTransactionsWithFlats } from '../../utils/bankParsers';
import { formatCurrency, getBuildingAccounts } from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function BankImportModal({ isOpen, onClose }) {
  const { state, t, addMultipleItems, showToast, updateBuildingData } = useApp();
  const { flats, currentLang, buildings, currentBuildingId, transactions: existingTxs, expenses: existingExpenses } = state;
  const isEn = currentLang === 'en';

  const currentBuilding = useMemo(() => {
    return (buildings || []).find(b => b.id === currentBuildingId) || buildings?.[0] || {};
  }, [buildings, currentBuildingId]);

  const buildingAccounts = useMemo(() => getBuildingAccounts(currentBuilding), [currentBuilding]);

  // Sorted flats for dropdown
  const sortedFlats = useMemo(() => {
    return [...(flats || [])].sort((a, b) => {
      const fa = String(a.flatNum || '');
      const fb = String(b.flatNum || '');
      return fa.localeCompare(fb, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [flats]);

  // 1. Bank selector state (persisted to building)
  const [selectedBank, setSelectedBank] = useState(() => currentBuilding.defaultBank || 'otp');
  const [bankSavedNotice, setBankSavedNotice] = useState(false);

  // Sync selectedBank when building changes
  useEffect(() => {
    if (currentBuilding?.defaultBank) {
      setSelectedBank(currentBuilding.defaultBank);
    }
  }, [currentBuilding?.id, currentBuilding?.defaultBank]);

  const handleBankChange = (newBank) => {
    setSelectedBank(newBank);
    if (updateBuildingData && currentBuilding?.id) {
      updateBuildingData(currentBuilding.id, { defaultBank: newBank });
      setBankSavedNotice(true);
      setTimeout(() => setBankSavedNotice(false), 3000);
    }
  };

  // 2. File and parsing state
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedMeta, setParsedMeta] = useState(null);
  const [matchedItems, setMatchedItems] = useState([]);
  const [showVerifiedPreview, setShowVerifiedPreview] = useState(false);

  // 3. Review Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);

  // Wizard active item edit form state
  const [wizardItemType, setWizardItemType] = useState('payment'); // 'payment' | 'expense'
  const [wizardFlatNum, setWizardFlatNum] = useState('');
  const [wizardTargetAccount, setWizardTargetAccount] = useState('Közös Költség');
  const [wizardCategory, setWizardCategory] = useState('Utility');
  const [wizardComment, setWizardComment] = useState('');

  // 4. Booking tracking state
  const [bookedIds, setBookedIds] = useState(new Set());
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  // Reset all state when modal opens/closes
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (currentBuilding?.defaultBank) {
        setSelectedBank(currentBuilding.defaultBank);
      }
    } else {
      // Reset state on close
      setIsParsing(false);
      setParseError(null);
      setParsedMeta(null);
      setMatchedItems([]);
      setShowVerifiedPreview(false);
      setIsWizardOpen(false);
      setWizardIndex(0);
      setBookedIds(new Set());
      setSkippedIds(new Set());
      setIsCompleted(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, currentBuilding]);

  // Derived groups of matched items
  const verifiedItems = useMemo(() => {
    return matchedItems.filter(item => item.status === 'Verified' && !item.isDuplicate && !bookedIds.has(item.id));
  }, [matchedItems, bookedIds]);

  const pendingItems = useMemo(() => {
    return matchedItems.filter(item => item.status === 'Pending' && !item.isDuplicate && !bookedIds.has(item.id) && !skippedIds.has(item.id));
  }, [matchedItems, bookedIds, skippedIds]);

  const duplicateItems = useMemo(() => {
    return matchedItems.filter(item => item.isDuplicate);
  }, [matchedItems]);

  // Direct Bank API Sync (mTLS)
  const [isApiSyncing, setIsApiSyncing] = useState(false);

  const handleApiSync = async () => {
    setIsApiSyncing(true);
    setParseError(null);

    try {
      // Connect to the Node.js backend mTLS endpoint
      const res = await fetch(`http://localhost:5001/api/bank/sync/${currentBuilding?.id || 'b1'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingIban: currentBuilding?.bankAccountKK || currentBuilding?.bankAccount,
          forceMock: false,
        })
      });

      if (!res.ok) {
        throw new Error(`A banki szerver válasza: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.success || !data.transactions || data.transactions.length === 0) {
        throw new Error(data.error || (isEn ? "No transactions returned from bank API." : "Nem érkezett feldolgozható tranzakció a banki API-tól."));
      }

      setParsedMeta({
        accountNumber: currentBuilding?.bankAccountKK || "OTP-CORP-API",
        accountName: currentBuilding?.name || "OTP Corporate Számla",
        period: new Date().toISOString().split('T')[0],
        totalCount: data.transactions.length,
        fileName: `OTP Corporate API (${data.mode === 'mock_sandbox' ? 'Sandbox / Teszt' : 'Éles mTLS'})`
      });

      // Run Smart Matching Engine
      const matched = matchTransactionsWithFlats({
        transactions: data.transactions,
        flats,
        building: currentBuilding,
        existingTransactions: existingTxs || [],
        existingExpenses: existingExpenses || []
      });

      setMatchedItems(matched);
      setBookedIds(new Set());
      setSkippedIds(new Set());
      setIsCompleted(false);

      if (showToast) {
        showToast(
          isEn 
            ? `Successfully retrieved ${data.transactions.length} transactions via OTP mTLS API!` 
            : `Sikeresen lekérve ${data.transactions.length} tranzakció az OTP mTLS API-n keresztül!`,
          'success'
        );
      }

    } catch (err) {
      console.error("API sync error:", err);
      setParseError(
        isEn
          ? `Bank API connection error: ${err.message}. Ensure the backend server is running on port 5001 (npm run server).`
          : `Banki API kapcsolódási hiba: ${err.message}. Győződjön meg róla, hogy a backend szerver fut az 5001-es porton (npm run server).`
      );
    } finally {
      setIsApiSyncing(false);
    }
  };

  // File drop & upload handler
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const parsed = await parseBankFile(file);
      if (!parsed || !parsed.transactions || parsed.transactions.length === 0) {
        throw new Error(t.bank_import_no_transactions || "Nem található feldolgozható tranzakció a feltöltött fájlban.");
      }

      setParsedMeta({
        accountNumber: parsed.accountNumber,
        accountName: parsed.accountName,
        period: parsed.period,
        totalCount: parsed.totalCount,
        fileName: file.name
      });

      // Run Smart Matching Engine
      const matched = matchTransactionsWithFlats({
        transactions: parsed.transactions,
        flats,
        building: currentBuilding,
        existingTransactions: existingTxs || [],
        existingExpenses: existingExpenses || []
      });

      setMatchedItems(matched);
      setBookedIds(new Set());
      setSkippedIds(new Set());
      setIsCompleted(false);

    } catch (err) {
      console.error("Bank parse error:", err);
      setParseError(err.message || (isEn ? "Failed to parse bank statement" : "Hiba történt a banki kivonat beolvasásakor"));
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // 1-Click Batch Booking for Verified Items
  const handleBookAllVerified = () => {
    if (verifiedItems.length === 0) return;

    const timestamp = Date.now();
    const transactionsToSave = [];
    const newBookedIds = new Set(bookedIds);

    verifiedItems.forEach((item, idx) => {
      const uniqueId = `t-bank-${item.bankTxId || timestamp}-${idx}`;
      const flatNumTarget = item.matchedFlat ? item.matchedFlat.flatNum : '-';
      
      const cleanComment = item.notice 
        ? `${item.counterpartyName ? item.counterpartyName + ' - ' : ''}${item.notice}`
        : (item.counterpartyName || (isEn ? "Bank credit" : "Banki jóváírás"));

      transactionsToSave.push({
        id: uniqueId,
        bankTxId: item.bankTxId || null,
        date: item.date,
        flatNum: flatNumTarget,
        targetAccount: item.targetAccount || 'Közös Költség',
        amount: Math.abs(item.amount),
        status: "Verified",
        method: "Bank Transfer",
        comment: cleanComment,
        includeInBalance: true,
        affectsBankBalance: true,
        includeInFlatBalance: true,
        counterpartyName: item.counterpartyName || '',
        counterpartyAccount: item.counterpartyAccount || '',
        attachments: []
      });

      newBookedIds.add(item.id);
    });

    addMultipleItems({
      transactions: transactionsToSave,
      expenses: [],
      debits: []
    });

    setBookedIds(newBookedIds);

    showToast(
      isEn 
        ? `${transactionsToSave.length} verified transactions booked successfully!` 
        : `${transactionsToSave.length} ellenőrzött tétel sikeresen lekönyvelve!`, 
      'success'
    );

    // If no pending items remain, complete
    if (pendingItems.length === 0) {
      setIsCompleted(true);
    }
  };

  // Wizard Setup & Population
  const activeWizardItem = pendingItems[wizardIndex] || null;

  useEffect(() => {
    if (activeWizardItem) {
      const isPositive = activeWizardItem.amount > 0;
      setWizardItemType(isPositive ? 'payment' : 'expense');
      
      // Auto pre-fill flat if smart matcher found a suggested flat
      if (activeWizardItem.matchedFlat) {
        setWizardFlatNum(activeWizardItem.matchedFlat.flatNum);
      } else if (sortedFlats.length > 0 && isPositive) {
        setWizardFlatNum(sortedFlats[0].flatNum);
      } else {
        setWizardFlatNum('');
      }

      setWizardTargetAccount(activeWizardItem.targetAccount || 'Közös Költség');

      // Guess expense category
      const cpLower = (activeWizardItem.counterpartyName || '').toLowerCase();
      const notLower = (activeWizardItem.notice || '').toLowerCase();
      if (cpLower.includes('otp') || cpLower.includes('bank') || notLower.includes('díj') || notLower.includes('jutalék')) {
        setWizardCategory('Bank Fee');
      } else if (cpLower.includes('mvm') || cpLower.includes('vízmű') || cpLower.includes('főtáv') || cpLower.includes('díjbeszedő')) {
        setWizardCategory('Utility');
      } else {
        setWizardCategory('Utility');
      }

      const defaultComment = activeWizardItem.notice 
        ? `${activeWizardItem.counterpartyName ? activeWizardItem.counterpartyName + ' - ' : ''}${activeWizardItem.notice}`
        : (activeWizardItem.counterpartyName || '');
      setWizardComment(defaultComment);
    }
  }, [activeWizardItem, sortedFlats]);

  const handleStartWizard = () => {
    setWizardIndex(0);
    setIsWizardOpen(true);
  };

  const handleWizardSkip = () => {
    if (!activeWizardItem) return;
    setSkippedIds(prev => new Set([...prev, activeWizardItem.id]));
    if (wizardIndex >= pendingItems.length - 1) {
      setIsWizardOpen(false);
      if (pendingItems.length <= 1) {
        setIsCompleted(true);
      }
    }
  };

  const handleWizardBookItem = () => {
    if (!activeWizardItem) return;

    const timestamp = Date.now();
    const cleanComment = wizardComment.trim() || activeWizardItem.notice || activeWizardItem.counterpartyName;
    const numAmount = Math.abs(activeWizardItem.amount);

    if (wizardItemType === 'payment') {
      const newTx = {
        id: `t-bank-${activeWizardItem.bankTxId || timestamp}`,
        bankTxId: activeWizardItem.bankTxId || null,
        date: activeWizardItem.date,
        flatNum: wizardFlatNum || '-',
        targetAccount: wizardTargetAccount,
        amount: numAmount,
        status: "Verified",
        method: "Bank Transfer",
        comment: cleanComment,
        includeInBalance: true,
        affectsBankBalance: true,
        includeInFlatBalance: true,
        counterpartyName: activeWizardItem.counterpartyName || '',
        counterpartyAccount: activeWizardItem.counterpartyAccount || '',
        attachments: []
      };

      addMultipleItems({
        transactions: [newTx],
        expenses: [],
        debits: []
      });
    } else {
      // Expense
      const newExp = {
        id: `e-bank-${activeWizardItem.bankTxId || timestamp}`,
        bankTxId: activeWizardItem.bankTxId || null,
        date: activeWizardItem.date,
        title: cleanComment,
        provider: activeWizardItem.counterpartyName || wizardTargetAccount,
        targetAccount: wizardTargetAccount,
        amount: numAmount,
        category: wizardCategory,
        includeInBalance: true,
        affectsBankBalance: true,
        attachments: []
      };

      addMultipleItems({
        transactions: [],
        expenses: [newExp],
        debits: []
      });
    }

    setBookedIds(prev => new Set([...prev, activeWizardItem.id]));

    showToast(
      isEn ? "Item approved and recorded in ledger!" : "Tétel jóváhagyva és rögzítve a könyvelésben!", 
      'success'
    );

    // Advance wizard or close if finished
    if (pendingItems.length <= 1) {
      setIsWizardOpen(false);
      setIsCompleted(true);
    }
  };

  const backdropProps = useBackdropClose(onClose);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div 
        className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-[#1E3A8A]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 font-display truncate">
                {t.bank_import_title}
              </h2>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                <span>{currentBuilding?.name || t.building_address}</span>
                <span>•</span>
                <span>{t.bank_import_subtitle}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
            title={isEn ? "Close" : "Bezárás"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* 1. Bank Selector Bar */}
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#1E3A8A] shrink-0" />
              <div>
                <label className="text-xs font-bold text-gray-700 block">
                  {t.bank_import_select_bank}
                </label>
                <span className="text-[11px] text-gray-500">
                  {currentBuilding?.name ? `${currentBuilding.name} számlavezetője` : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedBank}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full sm:w-64 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] shadow-2xs cursor-pointer"
              >
                <option value="otp">OTP Bank (HTML / XLS / XLSX)</option>
                <option value="kh">K&H Bank</option>
                <option value="erste">Erste Bank</option>
                <option value="mbh">MBH Bank</option>
                <option value="cib">CIB Bank</option>
                <option value="raiffeisen">Raiffeisen Bank</option>
                <option value="uni">UniCredit Bank</option>
                <option value="generic">Általános Excel / CSV (Standard)</option>
              </select>

              {bankSavedNotice && (
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 animate-fadeIn">
                  <Check className="w-3 h-3" />
                  {isEn ? "Saved" : "Mentve"}
                </span>
              )}
            </div>
          </div>

          {/* 2. Upload Screen (when no data parsed yet) */}
          {!parsedMeta && !isParsing && (
            <div className="space-y-4">
              {/* Direct OTP Bank Corporate API Banner */}
              {selectedBank === 'otp' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900 font-display">
                          {t.bank_import_api_sync_title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          RSA 4096 mTLS
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {t.bank_import_api_sync_desc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApiSync}
                    disabled={isApiSyncing}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isApiSyncing ? 'animate-spin' : ''}`} />
                    <span>{isApiSyncing ? t.bank_import_api_sync_loading : t.bank_import_api_sync_btn}</span>
                  </button>
                </div>
              )}

              {/* Drag and Drop File Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-[#1E3A8A] bg-blue-50/50 scale-[1.01]' 
                    : 'border-gray-300 hover:border-[#1E3A8A] hover:bg-gray-50/80 bg-white'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center shadow-xs">
                  <Upload className="w-7 h-7 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.bank_import_drop_title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    {t.bank_import_drop_hint}
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-2 px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {isEn ? "Select file from computer" : "Fájl kiválasztása a számítógépről"}
                </button>

                {parseError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 max-w-lg text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 border-3 border-blue-200 border-t-[#1E3A8A] rounded-full animate-spin" />
              <p className="text-sm font-bold text-gray-800 font-display">
                {t.bank_import_parsing}
              </p>
              <p className="text-xs text-gray-500">
                {isEn ? "Extracting bank metadata, matching flats and accounts..." : "Banki adatok kinyerése, lakások és alszámlák felismerése..."}
              </p>
            </div>
          )}

          {/* 3. Summary Dashboard & Smart Matching Results */}
          {parsedMeta && !isWizardOpen && (
            <div className="space-y-6">

              {/* Statement Metadata Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-700 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      {parsedMeta.fileName}
                    </span>
                    <span className="text-sm font-bold text-gray-900 truncate block">
                      {parsedMeta.accountName || currentBuilding?.name || (isEn ? "Condominium Account" : "Társasházi számla")}
                      {parsedMeta.accountNumber ? ` • ${parsedMeta.accountNumber}` : ''}
                    </span>
                    {parsedMeta.period && (
                      <span className="text-xs text-gray-500 block">
                        {t.bank_import_period}: <strong className="text-gray-700">{parsedMeta.period}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedMeta(null);
                      setMatchedItems([]);
                      setParseError(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t.bank_import_upload_another}
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                
                {/* 1. Verified */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      {t.bank_import_kpi_verified}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-emerald-800 font-display">
                      {verifiedItems.length} {isEn ? "items" : "tétel"}
                    </span>
                    <span className="text-xs text-emerald-700 block mt-0.5 font-semibold">
                      {formatCurrency(verifiedItems.reduce((sum, item) => sum + Math.abs(item.amount), 0))}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/90 leading-tight">
                    {t.bank_import_kpi_verified_desc}
                  </p>
                </div>

                {/* 2. Pending / Review */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      {t.bank_import_kpi_pending}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-amber-800 font-display">
                      {pendingItems.length} {isEn ? "items" : "tétel"}
                    </span>
                    <span className="text-xs text-amber-700 block mt-0.5 font-semibold">
                      {formatCurrency(pendingItems.reduce((sum, item) => sum + Math.abs(item.amount), 0))}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 leading-tight">
                    {t.bank_import_kpi_pending_desc}
                  </p>
                </div>

                {/* 3. Duplicates */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {t.bank_import_kpi_duplicates}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-2xl font-black text-gray-700 font-display">
                      {duplicateItems.length} {isEn ? "items" : "tétel"}
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5 font-medium">
                      {isEn ? "Filtered out automatically" : "Automatikusan kiszűrve"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {t.bank_import_kpi_duplicates_desc}
                  </p>
                </div>

              </div>

              {/* Main Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                  {verifiedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBookAllVerified}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.bank_import_book_verified} ({verifiedItems.length})</span>
                    </button>
                  )}

                  {pendingItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleStartWizard}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{t.bank_import_review_pending} ({pendingItems.length})</span>
                    </button>
                  )}
                </div>

                {/* Toggle preview of verified items */}
                {matchedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowVerifiedPreview(prev => !prev)}
                    className="text-xs text-[#1E3A8A] hover:underline font-bold flex items-center gap-1 cursor-pointer py-1"
                  >
                    {showVerifiedPreview ? t.bank_import_hide_details : t.bank_import_show_details}
                    {showVerifiedPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* All Done Celebration Message */}
              {isCompleted && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 animate-fadeIn">
                  <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-emerald-950 font-display">
                      {t.bank_import_all_done}
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {t.bank_import_all_done_desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                  >
                    {isEn ? "Done" : "Kész"}
                  </button>
                </div>
              )}

              {/* Detailed Verified Items Preview Table */}
              {showVerifiedPreview && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden animate-fadeIn">
                  <div className="p-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 font-display">
                      {t.bank_import_verified_table_title} ({matchedItems.length} tétel)
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {isEn ? "Auto-matched by Smart Engine" : "Az intelligens motor által párosítva"}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-200 text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">{t.date}</th>
                          <th className="py-2.5 px-3">{t.bank_import_target_flat}</th>
                          <th className="py-2.5 px-3">{t.bank_import_target_account}</th>
                          <th className="py-2.5 px-3">{t.amount}</th>
                          <th className="py-2.5 px-3">{t.bank_import_bank_notice}</th>
                          <th className="py-2.5 px-3">{t.status}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {matchedItems.map((item, idx) => {
                          const isBooked = bookedIds.has(item.id);
                          const isIncome = item.amount > 0;
                          return (
                            <tr key={idx} className={item.isDuplicate ? 'opacity-50 bg-gray-50' : 'hover:bg-blue-50/40'}>
                              <td className="py-2.5 px-3 font-medium text-gray-700 whitespace-nowrap">{item.date}</td>
                              <td className="py-2.5 px-3 font-bold text-gray-900">
                                {item.matchedFlat ? `${item.matchedFlat.flatNum}. lakás` : (item.counterpartyName || '-')}
                              </td>
                              <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{item.targetAccount}</td>
                              <td className={`py-2.5 px-3 font-bold whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isIncome ? '+' : ''}{formatCurrency(item.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate" title={item.notice || item.counterpartyName}>
                                {item.notice || item.counterpartyName || '-'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {isBooked ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {isEn ? "Booked" : "Lekönyvelve"}
                                  </span>
                                ) : item.isDuplicate ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600">
                                    {isEn ? "Duplicate" : "Duplikáció"}
                                  </span>
                                ) : item.status === 'Verified' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1E3A8A]">
                                    {isEn ? "Verified" : "Ellenőrzött"}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    {isEn ? "Pending" : "Függő"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 4. Interactive Review Wizard (Pending Items) */}
          {isWizardOpen && activeWizardItem && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Wizard Header & Progress */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 cursor-pointer"
                    title={isEn ? "Back to summary" : "Vissza az összefoglalóhoz"}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display">
                    {t.bank_import_wizard_title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    {wizardIndex + 1} / {pendingItems.length} {t.bank_import_wizard_step} {pendingItems.length}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-[#1E3A8A] h-1.5 transition-all duration-300"
                  style={{ width: `${((wizardIndex + 1) / pendingItems.length) * 100}%` }}
                />
              </div>

              {/* Wizard Content: 2-column on larger screens */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left Card: Bank Statement Raw Record */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {isEn ? "Bank Record Details" : "Bankkivonati tétel adatai"}
                  </span>

                  {/* Amount Badge */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs font-bold text-gray-600">{t.amount}:</span>
                    <span className={`text-xl font-black font-display ${activeWizardItem.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {activeWizardItem.amount > 0 ? '+' : ''}{formatCurrency(activeWizardItem.amount)}
                    </span>
                  </div>

                  {/* Notice (Highlight) */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-amber-900 uppercase block">
                      {t.bank_import_bank_notice}
                    </span>
                    <p className="text-xs font-bold text-gray-900 select-all">
                      {activeWizardItem.notice || (isEn ? "No notice provided" : "Nincs megadott közlemény")}
                    </p>
                  </div>

                  {/* Counterparty & Date Info */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-gray-500">{t.date}:</span>
                      <strong className="text-gray-800">{activeWizardItem.date}</strong>
                    </div>

                    {activeWizardItem.counterpartyName && (
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-gray-500">{t.bank_import_counterparty}:</span>
                        <strong className="text-gray-800 text-right">{activeWizardItem.counterpartyName}</strong>
                      </div>
                    )}

                    {activeWizardItem.counterpartyAccount && (
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-gray-500">{t.bank_import_counterparty_acc}:</span>
                        <span className="font-mono text-gray-700 text-right text-[11px]">{activeWizardItem.counterpartyAccount}</span>
                      </div>
                    )}

                    {activeWizardItem.bankTxId && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500">{t.bank_import_bank_tx_id}:</span>
                        <span className="font-mono text-gray-600 text-right text-[11px]">{activeWizardItem.bankTxId}</span>
                      </div>
                    )}
                  </div>

                  {/* Match Suggestions (if any) */}
                  {activeWizardItem.matchReasons && activeWizardItem.matchReasons.length > 0 && (
                    <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-[#1E3A8A]">
                      <span className="font-bold block mb-1">
                        {isEn ? "Smart Matching hints:" : "Intelligens párosítási javaslat:"}
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-900">
                        {activeWizardItem.matchReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>

                {/* Right Card: Interactive Review & Assignment Form */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    {isEn ? "Accounting Assignment" : "Könyvelési hozzárendelés"}
                  </span>

                  {/* Type Selector (Payment vs Expense) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      {t.bank_import_item_type}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWizardItemType('payment')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          wizardItemType === 'payment'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {t.bank_import_type_payment}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWizardItemType('expense')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          wizardItemType === 'expense'
                            ? 'bg-red-50 border-red-400 text-red-800 shadow-2xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {t.bank_import_type_expense}
                      </button>
                    </div>
                  </div>

                  {/* If Payment: Select Target Flat */}
                  {wizardItemType === 'payment' && (
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        {t.bank_import_target_flat}
                      </label>
                      <select
                        value={wizardFlatNum}
                        onChange={(e) => setWizardFlatNum(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] shadow-2xs cursor-pointer"
                      >
                        <option value="">{isEn ? "-- Select flat --" : "-- Válassz lakást --"}</option>
                        {sortedFlats.map(flat => (
                          <option key={flat.flatNum} value={flat.flatNum}>
                            {flat.flatNum}. {isEn ? "flat" : "lakás"} {flat.ownerName ? `(${flat.ownerName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* If Expense: Select Category */}
                  {wizardItemType === 'expense' && (
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        {t.bank_import_expense_cat}
                      </label>
                      <select
                        value={wizardCategory}
                        onChange={(e) => setWizardCategory(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] shadow-2xs cursor-pointer"
                      >
                        <option value="Utility">{t.cat_utility || "Közmű"}</option>
                        <option value="Insurance">{t.cat_insurance || "Biztosítás"}</option>
                        <option value="Maintenance">{t.cat_maintenance || "Karbantartás"}</option>
                        <option value="Bank Fee">{t.cat_bank_fee || "Banki költség"}</option>
                        <option value="Other">{t.cat_other || "Egyéb"}</option>
                      </select>
                    </div>
                  )}

                  {/* Target Account (KK vs FA vs Custom) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t.bank_import_target_account}
                    </label>
                    <select
                      value={wizardTargetAccount}
                      onChange={(e) => setWizardTargetAccount(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] shadow-2xs cursor-pointer"
                    >
                      <option value="Közös Költség">Közös Költség</option>
                      <option value="Felújítási Alap">Felújítási Alap</option>
                      {buildingAccounts.filter(a => !a.isBaseAccount).map(acc => (
                        <option key={acc.id} value={acc.name}>{acc.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ledger Comment */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t.bank_import_comment}
                    </label>
                    <input
                      type="text"
                      value={wizardComment}
                      onChange={(e) => setWizardComment(e.target.value)}
                      placeholder={isEn ? "Ledger description..." : "Könyvelési megjegyzés..."}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] shadow-2xs"
                    />
                  </div>

                  {/* Actions for this wizard item */}
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleWizardSkip}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-600 shadow-2xs transition-all cursor-pointer"
                    >
                      {t.bank_import_skip}
                    </button>

                    <button
                      type="button"
                      onClick={handleWizardBookItem}
                      disabled={wizardItemType === 'payment' && !wizardFlatNum}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.bank_import_save_and_next}</span>
                    </button>
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500">
            {parsedMeta && (
              <span>
                {t.bank_import_total_read}: <strong>{matchedItems.length} db</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            {isEn ? "Close" : "Bezárás"}
          </button>
        </div>

      </div>
    </div>
  );
}
