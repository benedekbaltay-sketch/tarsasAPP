import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Save, 
  Paperclip, 
  FileText, 
  Pencil, 
  Download, 
  PlusCircle, 
  MinusCircle, 
  Home 
} from 'lucide-react';
import { getCombinedFlatLedgerTimeline, translateCategory, getBuildingAccounts } from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { DEFAULT_CATEGORIES } from '../../constants/defaultData';
import {
  ALLOWED_ACCEPT_ATTR,
  validateUploadFile,
  readFileAsDataUrl,
  isSafeDownloadUrl,
  isSafeImagePreview,
  getFileValidationErrorMessage,
} from '../../utils/fileSecurity';

export function EditTransactionModal({ itemId, itemType, flatNum, isOpen, onClose, initialEditMode = false }) {
  const { state, t, editItem, showToast } = useApp();
  const { transactions, expenses, manualDebits, currentLang, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings?.[0];
  const allAccounts = useMemo(() => getBuildingAccounts(currentBuilding), [currentBuilding]);
  const customAccounts = useMemo(() => allAccounts.filter(a => !a.isBaseAccount), [allAccounts]);

  // Dynamic Building Categories taxonomy
  const buildingCategories = useMemo(() => {
    if (currentBuilding?.categories && Array.isArray(currentBuilding.categories) && currentBuilding.categories.length > 0) {
      return currentBuilding.categories;
    }
    return DEFAULT_CATEGORIES;
  }, [currentBuilding]);

  // Sorted list of flats for dropdown selection
  const sortedFlats = useMemo(() => {
    return (state.flats || [])
      .filter(f => f && f.flatNum !== undefined && f.flatNum !== null)
      .sort((a, b) => {
        const fa = String(a.flatNum || '');
        const fb = String(b.flatNum || '');
        return fa.localeCompare(fb, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [state.flats]);

  const [isEditMode, setIsEditMode] = useState(Boolean(initialEditMode));
  const [selectedType, setSelectedType] = useState('Payment'); // 'Payment' | 'Expense' | 'Debit'

  // Filtered categories according to current selectedType
  const filteredCategories = useMemo(() => {
    if (selectedType === 'Payment') {
      return buildingCategories.filter(c => c.type === 'income');
    } else {
      return buildingCategories.filter(c => c.type === 'expense');
    }
  }, [buildingCategories, selectedType]);

  const [selectedFlatNum, setSelectedFlatNum] = useState('');
  const [amountSign, setAmountSign] = useState(1); // 1 for +, -1 for -
  const [amount, setAmount] = useState('');
  const [targetAccount, setTargetAccount] = useState('Közös Költség');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [category, setCategory] = useState('Közös Költség befizetés');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [includeInBalance, setIncludeInBalance] = useState(true);
  const [attachments, setAttachments] = useState([]);

  const prevOpenKeyRef = useRef('');

  // Global ESC key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lookup current item across collections with multi-source fallback
  const currentItem = useMemo(() => {
    if (!isOpen || !itemId) return null;
    let item = null;

    // 1. Try preferred collection by itemType
    if (itemType === 'Expense') {
      item = (expenses || []).find(e => e.id === itemId);
    } else if (itemType === 'Debit') {
      item = (manualDebits || []).find(d => d.id === itemId);
    } else {
      item = (transactions || []).find(t => t.id === itemId);
    }

    // 2. Fallback across all collections if not found
    if (!item) {
      item = (manualDebits || []).find(d => d.id === itemId) ||
             (transactions || []).find(t => t.id === itemId) ||
             (expenses || []).find(e => e.id === itemId);
    }

    // 3. Fallback to flat timelines (recurring debits or computed timeline entries)
    if (!item) {
      if (flatNum) {
        const timeline = getCombinedFlatLedgerTimeline(flatNum, state);
        item = timeline.find(x => x.id === itemId);
      }
      if (!item) {
        for (const f of (state.flats || [])) {
          const timeline = getCombinedFlatLedgerTimeline(f.flatNum, state);
          const found = timeline.find(x => x.id === itemId);
          if (found) {
            item = found;
            break;
          }
        }
      }
    }
    return item;
  }, [isOpen, itemId, itemType, flatNum, expenses, manualDebits, transactions, state]);

  const isRecurringPrescription = useMemo(() => {
    return typeof itemId === 'string' && itemId.startsWith('d-') && !(manualDebits || []).some(d => d.id === itemId);
  }, [itemId, manualDebits]);

  const effectiveItemType = useMemo(() => {
    if (isRecurringPrescription) return 'Debit';
    if (currentItem) {
      if (currentItem.isExpense || (expenses || []).some(e => e.id === itemId)) return 'Expense';
      if (currentItem.type === 'Debit' || (manualDebits || []).some(d => d.id === itemId) || (typeof itemId === 'string' && itemId.startsWith('deb-'))) return 'Debit';
      return 'Payment';
    }
    return itemType || 'Payment';
  }, [currentItem, itemId, itemType, isRecurringPrescription, expenses, manualDebits]);

  const resetForm = () => {
    setSelectedType('Payment');
    setSelectedFlatNum('');
    setAmountSign(1);
    setAmount('');
    setTargetAccount('Közös Költség');
    setDate('');
    setPaymentMethod('Bank Transfer');
    setCategory('Közös Költség befizetés');
    setTitle('');
    setComment('');
    setIncludeInBalance(true);
    setAttachments([]);
  };

  const populateItemData = (it, type = effectiveItemType) => {
    if (!it) {
      resetForm();
      return;
    }
    let determinedType = type || 'Payment';
    if (it.isExpense || (expenses || []).some(e => e.id === it.id)) {
      determinedType = 'Expense';
    } else if (it.type === 'Debit' || (manualDebits || []).some(d => d.id === it.id) || (typeof it.id === 'string' && it.id.startsWith('deb-'))) {
      determinedType = 'Debit';
    } else if (isRecurringPrescription) {
      determinedType = 'Debit';
    } else {
      determinedType = 'Payment';
    }
    setSelectedType(determinedType);

    const initialFlat = it.flatNum || flatNum || (determinedType !== 'Expense' ? ((sortedFlats[0]?.flatNum) || 'Fsz 1') : '');
    setSelectedFlatNum(initialFlat === '-' || initialFlat === 'Global' ? '' : initialFlat);

    const rawAmount = Number(it.amount) || 0;
    if (rawAmount < 0) {
      setAmountSign(-1);
      setAmount(Math.abs(rawAmount).toString());
    } else {
      setAmountSign(1);
      setAmount(Math.abs(rawAmount).toString());
    }

    let initialDate = it.date || '';
    if (initialDate.length === 7) {
      initialDate = `${initialDate}-01`;
    }
    setDate(initialDate);

    setTargetAccount(it.targetAccount || (it.account === 'Felújítási Alap' ? 'Felújítási Alap' : 'Közös Költség'));
    setTitle(it.title || (it.provider !== 'Közös Költség' && it.provider !== 'Felújítási Alap' ? it.provider : '') || '');
    setComment(it.comment || '');
    setIncludeInBalance(it.affectsBankBalance !== false && it.includeInBalance !== false);
    setAttachments(it.attachments || (it.attachment ? [it.attachment] : []));

    // Normalize payment method
    const rawMethod = it.paymentMethod || it.method || (it.category === 'Cash' || it.category === 'Cash Offset' ? 'Cash' : 'Bank Transfer');
    const normMethod = (rawMethod === 'Cash' || rawMethod === 'Készpénz' || rawMethod === 'Cash Offset') ? 'Cash' : 'Bank Transfer';
    setPaymentMethod(normMethod);

    // Normalize category
    const relevantCats = determinedType === 'Payment'
      ? buildingCategories.filter(c => c.type === 'income')
      : buildingCategories.filter(c => c.type === 'expense');

    const matchingCat = relevantCats.find(c => c.name === it.category || c.id === it.category);
    setCategory(it.category || matchingCat?.name || (determinedType === 'Payment' ? 'Közös Költség befizetés' : 'Közüzemi díj (Víz, Gáz, Áram)'));
  };

  useEffect(() => {
    if (!isOpen || !itemId) {
      prevOpenKeyRef.current = '';
      setIsEditMode(false);
      resetForm();
      return;
    }

    const currentKey = `${itemId}-${effectiveItemType}-${Boolean(initialEditMode)}`;
    if (prevOpenKeyRef.current !== currentKey) {
      prevOpenKeyRef.current = currentKey;
      setIsEditMode(Boolean(initialEditMode));
      if (currentItem) {
        populateItemData(currentItem, effectiveItemType);
      } else {
        resetForm();
      }
    } else if (currentItem && !isEditMode) {
      populateItemData(currentItem, effectiveItemType);
    }
  }, [isOpen, itemId, effectiveItemType, initialEditMode, currentItem]);

  const handleClose = () => {
    prevOpenKeyRef.current = '';
    setIsEditMode(false);
    resetForm();
    onClose();
  };

  const handleCancelEdit = () => {
    if (currentItem) {
      populateItemData(currentItem, effectiveItemType);
    } else {
      resetForm();
    }
    setIsEditMode(false);
  };

  const backdropProps = useBackdropClose(handleClose);

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !itemId || !isAdmin) return null;

  const handleTypeSelect = (newType) => {
    setSelectedType(newType);
    setAmountSign(1);
    const relevantCats = newType === 'Payment'
      ? buildingCategories.filter(c => c.type === 'income')
      : buildingCategories.filter(c => c.type === 'expense');

    const matches = relevantCats.some(c => c.name === category || c.id === category);
    if (!matches && relevantCats.length > 0) {
      const firstCat = relevantCats[0];
      setCategory(firstCat.name);
      if (firstCat.defaultFund) {
        setTargetAccount(firstCat.defaultFund);
      }
    }

    if (newType !== 'Expense' && !selectedFlatNum) {
      setSelectedFlatNum(flatNum || (sortedFlats[0]?.flatNum) || 'Fsz 1');
    }
  };

  const handleCategoryChange = (catNameOrId) => {
    const selectedCat = buildingCategories.find(c => c.id === catNameOrId || c.name === catNameOrId);
    const chosenName = selectedCat ? selectedCat.name : catNameOrId;
    setCategory(chosenName);
    if (selectedCat && selectedCat.defaultFund) {
      setTargetAccount(selectedCat.defaultFund);
    }
  };

  const handlePaymentMethodChange = (newMethod) => {
    setPaymentMethod(newMethod);
    if (newMethod === 'Cash') {
      setIncludeInBalance(false);
    } else {
      setIncludeInBalance(true);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) {
      const check = await validateUploadFile(file);
      if (!check.ok) {
        if (showToast) showToast(getFileValidationErrorMessage(check.reason, t, isEn), "error");
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setAttachments(prev => [...prev, {
          name: check.sanitizedName,
          size: check.sizeFormatted,
          data: dataUrl
        }]);
      } catch {
        if (showToast) showToast(isEn ? "Error reading file." : "Hiba történt a fájl beolvasásakor.", "error");
      }
    }
  };

  const handleRemoveAttachment = (idxToRemove) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const numAmount = Math.abs(Number(amount));
    if (amount === '' || isNaN(numAmount) || numAmount === 0) return;

    const finalAmount = (selectedType === 'Payment' && amountSign === -1) ? -numAmount : numAmount;

    const updatedFields = {
      date,
      amount: selectedType === 'Expense' ? numAmount : finalAmount,
      targetAccount,
      flatNum: selectedFlatNum || null,
      comment: comment.trim(),
      includeInBalance: Boolean(includeInBalance),
      affectsBankBalance: Boolean(includeInBalance),
      includeInFlatBalance: true,
      attachments,
      category,
      method: paymentMethod,
      paymentMethod
    };

    if (selectedType === 'Expense') {
      updatedFields.title = title.trim();
      updatedFields.provider = title.trim() || comment.trim() || targetAccount;
    } else if (selectedType === 'Debit' || isRecurringPrescription) {
      updatedFields.title = title.trim() || comment.trim() || (isEn ? "Debit" : "Előírás / Terhelés");
    } else {
      updatedFields.title = title.trim();
    }

    editItem(
      itemId, 
      isRecurringPrescription && selectedType === 'Debit' ? 'Debit' : selectedType, 
      updatedFields, 
      selectedFlatNum || flatNum
    );
    setIsEditMode(false);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-xl sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-scaleUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
              {isEditMode 
                ? (isRecurringPrescription ? (isEn ? "Edit Monthly Fee" : "Havi előírás szerkesztése") : (t.edit_item_title || (isEn ? "Edit Accounting Item" : "Könyvelési tétel szerkesztése")))
                : (isRecurringPrescription ? (t.monthly_fee_details_title || (isEn ? "Monthly Fee Details" : "Havi előírás adatai")) : (t.item_details_title || (isEn ? "Item Details" : "Tétel adatai")))}
            </h3>
            <p className="text-[11px] text-gray-500 truncate">
              {isEditMode 
                ? (isEn ? "All properties and cross-type classification are editable" : "Minden tulajdonság és típusmódosítás szabadon szerkeszthető")
                : (isEn ? "Detailed ledger and accounting entry inspection" : "Részletes könyvelési tétel és egyenleg információk")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1E3A8A] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                title={isEn ? "Edit all aspects" : "Tétel szerkesztése"}
              >
                <Pencil className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={handleClose} 
              className="p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
              title={t.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode 1: Read-Only Item Details View */}
        {!isEditMode ? (
          <>
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
              {/* Main Amount & Account Card */}
              <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                    {t.amount}
                  </span>
                  <span className={`text-xl sm:text-2xl font-black font-display truncate block ${
                    Math.abs(Math.round(Number(amount) || 0)) === 0 
                      ? 'text-gray-700' 
                      : (effectiveItemType === 'Expense' || effectiveItemType === 'Debit' || isRecurringPrescription || amountSign === -1 
                          ? 'text-red-600' 
                          : 'text-emerald-600')
                  }`}>
                    {Math.abs(Math.round(Number(amount) || 0)) === 0 
                      ? '' 
                      : (effectiveItemType === 'Expense' || effectiveItemType === 'Debit' || isRecurringPrescription || amountSign === -1 ? '-' : '+')}
                    {Math.abs(Math.round(Number(amount) || 0)).toLocaleString('hu-HU')} Ft
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border shadow-2xs ${
                    targetAccount === 'Közös Költség' 
                      ? 'bg-blue-50 text-[#1E3A8A] border-blue-200' 
                      : targetAccount === 'Felújítási Alap'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}>
                    {targetAccount === 'Közös Költség' ? 'Közös Költség (KK)' : (targetAccount === 'Felújítási Alap' ? 'Felújítási Alap (FA)' : targetAccount)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    effectiveItemType === 'Expense'
                      ? 'bg-red-100 text-red-700'
                      : effectiveItemType === 'Debit' || isRecurringPrescription
                        ? 'bg-amber-100 text-amber-800'
                        : amountSign === -1
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {effectiveItemType === 'Expense' 
                      ? (isEn ? "Expense (-)" : "Kiadás (-)") 
                      : effectiveItemType === 'Debit' || isRecurringPrescription 
                        ? (isEn ? "Assessment / Debit" : "Előírás / Terhelés") 
                        : (amountSign === -1 ? (isEn ? "Deduction (-)" : "Levonás (-)") : (isEn ? "Payment (+)" : "Befizetés (+)"))}
                  </span>
                </div>
              </div>

              {/* Details Table / Grid */}
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 text-xs overflow-hidden">
                {/* Affected Flat */}
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-500 font-medium flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-gray-400" />
                    <span>{t.affected_flat || (isEn ? "Affected flat" : "Érintett lakás")}</span>
                  </span>
                  <span className="font-bold text-gray-900">
                    {selectedFlatNum && selectedFlatNum !== '-' && selectedFlatNum !== 'Global' 
                      ? `${selectedFlatNum}. ${isEn ? "flat" : "lakás"}` 
                      : (t.entire_building_common || (isEn ? "Entire building (Common item)" : "Teljes társasház (Közös tétel)"))}
                  </span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-500 font-medium">{t.date}</span>
                  <span className="font-bold text-gray-900 font-mono">{date || '-'}</span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-500 font-medium">
                    {effectiveItemType === 'Expense'
                      ? (t.expense_category_label || (isEn ? "Expense Category" : "Kiadási kategória"))
                      : (effectiveItemType === 'Debit' || isRecurringPrescription
                          ? (t.debit_category || (isEn ? "Debit Category" : "Előírás kategória"))
                          : (t.category_label || (isEn ? "Category" : "Kategória")))}
                  </span>
                  <span className="font-bold text-gray-900">{translateCategory(category, isEn) || category || '-'}</span>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-500 font-medium">
                    {t.payment_method_field || (isEn ? "Payment Method" : "Fizetési mód")}
                  </span>
                  <span className="font-bold text-gray-900">
                    {paymentMethod === 'Cash' ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold">
                        {t.payment_method_cash || (isEn ? "Cash (Register)" : "Készpénz (Pénztár)")}
                      </span>
                    ) : (
                      <span>{t.payment_method_bank || (isEn ? "Bank Transfer" : "Banki átutalás")}</span>
                    )}
                  </span>
                </div>

                {(title || (currentItem?.provider && currentItem.provider !== targetAccount)) && (
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <span className="text-gray-500 font-medium shrink-0">
                      {isEn ? "Title / Payee" : "Megnevezés / Partner"}
                    </span>
                    <span className="font-bold text-gray-900 truncate text-right">{title || currentItem?.provider || '-'}</span>
                  </div>
                )}

                {comment && (
                  <div className="p-3.5 space-y-1">
                    <span className="text-gray-500 font-medium block">{t.comment}</span>
                    <div className="p-2.5 bg-gray-50 rounded-xl text-gray-800 font-medium border border-gray-100 break-words">
                      {comment}
                    </div>
                  </div>
                )}

                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-gray-500 font-medium">{t.include_in_balance_label}</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-md ${includeInBalance ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}>
                    {includeInBalance ? (isEn ? "Yes" : "Igen") : (isEn ? "No" : "Nem")}
                  </span>
                </div>
              </div>

              {/* Attachments (if any) */}
              {attachments && attachments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t.attach_doc} ({attachments.length})</span>
                  </span>
                  <div className="space-y-1.5">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {isSafeImagePreview(att) ? (
                            <img src={att.data} alt={att.name} className="w-7 h-7 rounded-lg object-cover border border-blue-200 shrink-0 shadow-2xs" />
                          ) : (
                            <FileText className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                          )}
                          <span className="truncate font-semibold text-gray-800 max-w-[170px]" title={att.name}>
                            {att.name}
                          </span>
                        </div>
                        {isSafeDownloadUrl(att.data) && (
                          <a
                            href={att.data}
                            download={att.name}
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-[#1E3A8A] transition-colors"
                          >
                            <Download className="w-3 h-3 text-[#1E3A8A]" />
                            <span>{isEn ? "Download" : "Letöltés"}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer in Read-Only Mode */}
            <div className="p-3 sm:px-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white bg-gray-50 cursor-pointer transition-colors"
              >
                {t.close || (isEn ? "Close" : "Bezárás")}
              </button>
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
              </button>
            </div>
          </>
        ) : (
          /* Mode 2: Editable Form View (All Aspects Editable) */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
            
            {/* 1. Cross-Type Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                {isEn ? "Transaction Type" : "Tétel típusa"}
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => handleTypeSelect('Payment')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedType === 'Payment'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-emerald-700 hover:bg-white/60'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isEn ? "Payment (+)" : "Befizetés (+)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelect('Expense')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedType === 'Expense'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-red-700 hover:bg-white/60'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isEn ? "Expense (-)" : "Kiadás (-)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelect('Debit')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedType === 'Debit'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-blue-800 hover:bg-white/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isEn ? "Debit" : "Előírás"}</span>
                </button>
              </div>
            </div>

            {/* 2. Affected Flat & Amount (2-column grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Affected Flat Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-gray-500" />
                  <span>{t.affected_flat || (isEn ? "Affected flat" : "Érintett lakás")}</span>
                </label>
                <select
                  value={selectedFlatNum}
                  onChange={(e) => setSelectedFlatNum(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  {selectedType === 'Expense' && (
                    <option value="">{t.entire_building_common || (isEn ? "Entire building (Common item)" : "Teljes társasház (Közös tétel)")}</option>
                  )}
                  {sortedFlats.map(f => (
                    <option key={f.flatNum} value={f.flatNum}>
                      {f.flatNum}. lakás {f.ownerName ? `(${f.ownerName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    {t.amount || (isEn ? "Amount" : "Összeg")} (Ft)
                  </label>
                  {selectedType === 'Payment' && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-500 hover:text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={amountSign === -1}
                        onChange={(e) => setAmountSign(e.target.checked ? -1 : 1)}
                        className="w-3 h-3 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                      />
                      <span className={amountSign === -1 ? 'text-red-600 font-bold' : ''}>
                        {t.negative_refund_correction || (isEn ? "Refund (-)" : "Negatív (-)")}
                      </span>
                    </label>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full px-3 py-2 bg-gray-50 border rounded-xl text-sm font-black focus:bg-white focus:ring-1 focus:ring-blue-500 ${
                      (selectedType === 'Payment' && amountSign === -1) || selectedType === 'Expense'
                        ? 'text-red-600 border-red-200 focus:border-red-500'
                        : 'text-gray-900 border-gray-200'
                    }`}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    Ft
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Category & Target Account (2-column grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  {t.category_label || (isEn ? "Category" : "Kategória")}
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:bg-white"
                >
                  {filteredCategories.map(cat => (
                    <option key={cat.id || cat.name} value={cat.name}>
                      {isEn ? (cat.nameEn || cat.name) : cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Bank Account Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  {isEn ? "Account / Fund" : "Számla / Alap"}
                </label>
                <select
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Közös Költség">{isEn ? "Common Cost (KK)" : "Közös Költség (KK)"}</option>
                  <option value="Felújítási Alap">{isEn ? "Renovation Fund (FA)" : "Felújítási Alap (FA)"}</option>
                  {customAccounts.map(acc => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name} {acc.shortName ? `(${acc.shortName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Payment Method & Date (2-column grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Payment Method Toggle */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                  {t.payment_method_field || (isEn ? "Payment Method" : "Fizetési mód")}
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('Bank Transfer')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                      paymentMethod === 'Bank Transfer'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t.payment_method_bank || (isEn ? "Bank Transfer" : "Banki átutalás")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('Cash')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                      paymentMethod === 'Cash'
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t.payment_method_cash || (isEn ? "Cash (Register)" : "Készpénz (Pénztár)")}
                  </button>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">{t.date}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* 5. Smart Bank Balance Impact Checkbox */}
            <div className={`p-3 rounded-2xl border transition-colors ${
              includeInBalance ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInBalance}
                  onChange={(e) => setIncludeInBalance(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-[#1E3A8A] rounded focus:ring-[#1E3A8A] cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-gray-900 block">{t.include_in_balance_label}</span>
                  <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                    {includeInBalance
                      ? (t.smart_balance_hint_bank || (isEn ? "✓ Affects both bank account and flat balance" : "✓ Módosítja a társasházi folyószámla főösszeget és a lakásegyenleget"))
                      : (t.smart_balance_hint_cash || (isEn ? "✗ Affects flat balance only (bank account total unchanged)" : "✗ Csak a lakás egyenlegét módosítja (a folyószámla főösszeget nem)"))}
                  </span>
                </div>
              </label>
            </div>

            {/* 10. Attachments */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.attach_doc}</span>
              </label>
              <input
                type="file"
                multiple
                accept={ALLOWED_ACCEPT_ATTR}
                onChange={handleFileUpload}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isSafeImagePreview(att) ? (
                          <img src={att.data} alt={att.name} className="w-6 h-6 rounded-md object-cover border border-blue-200 shrink-0 shadow-2xs" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
                        )}
                        <span className="truncate font-medium text-gray-700 max-w-[200px]" title={att.name}>
                          {att.name}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          ({att.size})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                        title={isEn ? "Remove attachment" : "Csatolmány törlése"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t.save}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
