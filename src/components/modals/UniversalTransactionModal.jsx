import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  PlusCircle, 
  MinusCircle, 
  FileText, 
  Paperclip, 
  Building, 
  Home, 
  Users, 
  Search, 
  Check, 
  AlertCircle,
  Loader2,
  ArrowLeftRight
} from 'lucide-react';
import { formatCurrency, getCurrentFee, getBuildingAccounts } from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { DEFAULT_CATEGORIES } from '../../constants/defaultData';

export function UniversalTransactionModal({ isOpen, onClose, initialData = null }) {
  const { state, t, addMultipleItems, showToast } = useApp();
  const { flats, currentLang, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';

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

  // Sorted list of flats for natural ordering (e.g. Fsz 1, Fsz 2, I 4...)
  const sortedFlats = useMemo(() => {
    return (flats || [])
      .filter(f => f && f.flatNum !== undefined && f.flatNum !== null)
      .sort((a, b) => {
        const fa = String(a.flatNum || '');
        const fb = String(b.flatNum || '');
        return fa.localeCompare(fb, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [flats]);

  // 1. Transaction Type: 'payment' | 'expense' | 'debit' | 'transfer'
  const [txType, setTxType] = useState('payment');

  // Filtered categories according to transaction mode
  const filteredCategories = useMemo(() => {
    if (txType === 'payment') {
      return buildingCategories.filter(c => c.type === 'income');
    } else if (txType === 'expense' || txType === 'debit') {
      return buildingCategories.filter(c => c.type === 'expense');
    }
    return buildingCategories;
  }, [buildingCategories, txType]);

  // 2. Scope: 'global' | 'single' | 'multi'
  const [scope, setScope] = useState('single');

  // 3. Single Flat selection
  const [selectedFlatNum, setSelectedFlatNum] = useState(() => (sortedFlats && sortedFlats[0]?.flatNum) || 'Fsz 1');

  // 4. Multi-flat selection & multipliers
  const [selectedFlats, setSelectedFlats] = useState({});
  const [multipliers, setMultipliers] = useState({});
  const [flatSearch, setFlatSearch] = useState('');

  // 5. Financial fields
  const [singleAmount, setSingleAmount] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [targetAccount, setTargetAccount] = useState('Közös Költség');
  const [fromAccount, setFromAccount] = useState('Közös Költség');
  const [toAccount, setToAccount] = useState('Felújítási Alap');
  const [affectsBalance, setAffectsBalance] = useState(true);

  // 6. Payment Method: 'Bank Transfer' (default) | 'Cash'
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');

  // 7. Details
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('Közös Költség befizetés');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Global ESC key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Potential duplicate detection
  const potentialDuplicate = useMemo(() => {
    if (!isOpen || scope !== 'single' || !singleAmount || isNaN(Number(singleAmount)) || txType === 'transfer') return null;
    const numAmount = Number(singleAmount);
    if (numAmount === 0) return null;

    if (txType === 'payment') {
      return (state.transactions || []).find(t => 
        t && t.flatNum === selectedFlatNum && t.date === date && Number(t.amount) === numAmount && t.targetAccount === targetAccount
      );
    } else if (txType === 'expense') {
      return (state.expenses || []).find(e => 
        e && e.date === date && Number(e.amount) === numAmount && e.targetAccount === targetAccount
      );
    } else if (txType === 'debit') {
      return (state.manualDebits || []).find(d => 
        d && d.flatNum === selectedFlatNum && d.date === date && Number(d.amount) === numAmount && d.targetAccount === targetAccount
      );
    }
    return null;
  }, [isOpen, scope, singleAmount, txType, selectedFlatNum, date, targetAccount, state.transactions, state.expenses, state.manualDebits]);

  // Refs to track open transition and request keys so user drafts are NEVER wiped while open
  const prevIsOpenRef = useRef(false);
  const prevInitKeyRef = useRef('');

  // Initialize form state ONLY when modal opens or a different initialData request is opened
  useEffect(() => {
    if (!isOpen) {
      if (prevIsOpenRef.current) {
        prevIsOpenRef.current = false;
        prevInitKeyRef.current = '';
        setSelectedFlats({});
        setMultipliers({});
        setAttachments([]);
        setSingleAmount('');
        setBaseAmount('');
        setComment('');
        setIsSubmitting(false);
      }
      return;
    }

    const initKey = JSON.stringify(initialData || {});
    const isJustOpened = !prevIsOpenRef.current;
    const isNewRequest = initKey !== prevInitKeyRef.current;

    if (isJustOpened || isNewRequest) {
      prevIsOpenRef.current = true;
      prevInitKeyRef.current = initKey;
      setIsSubmitting(false);

      const validTypes = ['payment', 'expense', 'debit', 'transfer'];
      const initType = validTypes.includes(initialData?.type) ? initialData.type : 'payment';
      const validScopes = ['global', 'single', 'multi'];
      const initScope = validScopes.includes(initialData?.scope) 
        ? initialData.scope 
        : (initialData?.flatNum ? 'single' : 'single');
      const firstFlat = (sortedFlats && sortedFlats[0]?.flatNum) || 'Fsz 1';
      const initFlatNum = initialData?.flatNum || firstFlat;
      const initAmount = initialData?.amount !== undefined && initialData?.amount !== null ? String(initialData.amount) : '';

      // Normalize payment method
      const rawMethod = initialData?.paymentMethod || initialData?.method || 'Bank Transfer';
      const normMethod = (rawMethod === 'Cash' || rawMethod === 'Készpénz' || rawMethod === 'Cash Offset') ? 'Cash' : 'Bank Transfer';
      setPaymentMethod(normMethod);

      // Select initial category based on type
      const relevantCats = initType === 'payment'
        ? buildingCategories.filter(c => c.type === 'income')
        : buildingCategories.filter(c => c.type === 'expense');

      const matchingCat = relevantCats.find(c => c.name === initialData?.category || c.id === initialData?.category) || relevantCats[0];
      const initCategory = initialData?.category || matchingCat?.name || (initType === 'payment' ? 'Közös Költség befizetés' : 'Közüzemi díj (Víz, Gáz, Áram)');
      setCategory(initCategory);

      const initAccount = initialData?.targetAccount || matchingCat?.defaultFund || 'Közös Költség';

      setTxType(initType);
      setScope(initType === 'transfer' && initScope === 'multi' ? 'single' : initScope);
      setSelectedFlatNum(initFlatNum);
      setSingleAmount(initAmount);
      setBaseAmount(initialData?.baseAmount ? String(initialData.baseAmount) : '');
      setTargetAccount(initAccount);
      setFromAccount(initialData?.fromAccount || 'Közös Költség');
      setToAccount(initialData?.toAccount || 'Felújítási Alap');
      
      // Auto-configure affectsBalance:
      // If Cash -> false; otherwise payment -> true, expense -> true, debit -> false, transfer -> true
      if (initialData?.affectsBalance !== undefined) {
        setAffectsBalance(Boolean(initialData.affectsBalance));
      } else {
        if (normMethod === 'Cash') {
          setAffectsBalance(false);
        } else {
          setAffectsBalance(initType !== 'debit');
        }
      }

      setDate(initialData?.date || new Date().toISOString().slice(0, 10));
      setComment(initialData?.comment || '');
      setAttachments([]);
      setFlatSearch('');

      // Pre-select multi-flats if passed, otherwise empty
      if (initialData?.selectedFlats) {
        setSelectedFlats(initialData.selectedFlats);
      } else {
        setSelectedFlats({});
      }
      setMultipliers(initialData?.multipliers || {});
    }
  }, [isOpen, initialData, buildingCategories]);

  // Handle changing type (Befizetés / Kiadás / Előírás / Átvezetés)
  const handleTypeChange = (newType) => {
    setTxType(newType);
    const relevantCats = newType === 'payment'
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

    if (paymentMethod === 'Cash') {
      setAffectsBalance(false);
    } else if (newType === 'debit') {
      setAffectsBalance(false);
    } else {
      setAffectsBalance(true);
    }

    if (newType === 'transfer' && scope === 'multi') {
      setScope('single');
    }
  };

  // Handle category change: auto-selects defaultFund, but keeps it editable
  const handleCategoryChange = (catNameOrId) => {
    const selectedCat = buildingCategories.find(c => c.id === catNameOrId || c.name === catNameOrId);
    const chosenName = selectedCat ? selectedCat.name : catNameOrId;
    setCategory(chosenName);
    if (selectedCat && selectedCat.defaultFund) {
      setTargetAccount(selectedCat.defaultFund);
    }
  };

  // Handle payment method toggle (Bank Transfer vs Cash) with smart balance checkbox sync
  const handlePaymentMethodChange = (newMethod) => {
    setPaymentMethod(newMethod);
    if (newMethod === 'Cash') {
      setAffectsBalance(false);
    } else {
      setAffectsBalance(true);
    }
  };

  // Multi-flat helper functions
  const handleToggleFlat = (flatNum) => {
    setSelectedFlats(prev => ({
      ...prev,
      [flatNum]: !prev[flatNum]
    }));
    if (!multipliers[flatNum]) {
      setMultipliers(prev => ({ ...prev, [flatNum]: 1 }));
    }
  };

  const handleStepMultiplier = (flatNum, step) => {
    setMultipliers(prev => {
      const current = prev[flatNum] || 1;
      const updated = Math.max(1, current + step);
      return { ...prev, [flatNum]: updated };
    });
  };

  const handleSelectAllFlats = () => {
    const updated = {};
    const updatedMults = { ...multipliers };
    sortedFlats.forEach(f => {
      updated[f.flatNum] = true;
      if (!updatedMults[f.flatNum]) {
        updatedMults[f.flatNum] = 1;
      }
    });
    setSelectedFlats(updated);
    setMultipliers(updatedMults);
  };

  const handleDeselectAllFlats = () => {
    setSelectedFlats({});
  };

  // Calculations for multi-flat mode
  const selectedCount = Object.keys(selectedFlats).filter(k => selectedFlats[k]).length;
  const numBaseAmount = Number(baseAmount) || 0;

  const { totalUnits, totalCalculatedAmount } = useMemo(() => {
    let units = 0;
    let sum = 0;
    Object.keys(selectedFlats).forEach(fNum => {
      if (selectedFlats[fNum]) {
        const mult = multipliers[fNum] || 1;
        units += mult;
        sum += (numBaseAmount * mult);
      }
    });
    return { totalUnits: units, totalCalculatedAmount: sum };
  }, [selectedFlats, multipliers, numBaseAmount]);

  // 1-month fee calculation for single flat
  const selectedFlatObj = useMemo(() => {
    return (flats || []).find(f => f && String(f.flatNum) === String(selectedFlatNum));
  }, [flats, selectedFlatNum]);

  const selectedAccountMeta = useMemo(() => {
    return (allAccounts || []).find(a => a.name === targetAccount || a.id === targetAccount || a.shortName === targetAccount);
  }, [allAccounts, targetAccount]);

  const oneMonthFeeForSelected = useMemo(() => {
    if (!selectedFlatObj || (selectedAccountMeta && !selectedAccountMeta.hasMonthlyFee)) return 0;
    const accountKey = selectedAccountMeta?.id || (targetAccount === 'Felújítási Alap' ? 'FA' : (targetAccount === 'Közös Költség' ? 'KK' : targetAccount));
    const cur = getCurrentFee(selectedFlatObj, accountKey);
    if (cur > 0) return cur;
    let fallback = 0;
    if (accountKey === 'FA' || targetAccount === 'Felújítási Alap') {
      fallback = Number(selectedFlatObj.renovationFee);
    } else if (accountKey === 'KK' || targetAccount === 'Közös Költség') {
      fallback = Number(selectedFlatObj.monthlyFee);
    } else {
      fallback = Number(selectedFlatObj.customFees?.[accountKey] || selectedFlatObj.customFees?.[targetAccount]);
    }
    return fallback > 0 ? fallback : 0;
  }, [selectedFlatObj, targetAccount, selectedAccountMeta]);

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'xls', 'docx', 'doc'];

  // File upload handling
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        if (showToast) showToast(t.file_too_large || "A feltöltött fájl mérete túl nagy! A megengedett maximális méret 2 MB.", "error");
        return;
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        if (showToast) showToast(t.file_type_unsupported || "Nem támogatott fájlformátum! Kizárólag PDF, JPG, PNG vagy XLSX tölthető fel.", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          size: (file.size / 1024).toFixed(0) + " KB",
          data: reader.result
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveAttachment = (idxToRemove) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const timestamp = Date.now();
    const cleanComment = comment.trim();

    const transactionsToSave = [];
    const expensesToSave = [];
    const debitsToSave = [];

    if (txType === 'transfer') {
      const numSingleAmount = Math.abs(Number(singleAmount));
      if (singleAmount === '' || isNaN(numSingleAmount) || numSingleAmount === 0 || (scope === 'single' && !selectedFlatNum)) {
        setIsSubmitting(false);
        return;
      }
      if (fromAccount === toAccount) {
        if (showToast) showToast(t.transfer_from_to_same_error || "A forrás és a cél számla nem lehet azonos!", "error");
        setIsSubmitting(false);
        return;
      }

      const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 4)}`;
      const flatTarget = scope === 'global' ? '-' : selectedFlatNum;

      // 1. Source account deduction (negative transaction)
      transactionsToSave.push({
        id: `t-${uniqueId}-from`,
        date,
        flatNum: flatTarget,
        targetAccount: fromAccount,
        amount: -numSingleAmount,
        status: "Verified",
        method: "Bank Transfer",
        comment: cleanComment 
          ? `${cleanComment} (${t.source_deduction_note || 'Átvezetés miatti levonás'} -> ${toAccount})` 
          : `${t.source_deduction_note || 'Átvezetés miatti levonás'} -> ${toAccount}`,
        includeInBalance: Boolean(affectsBalance),
        affectsBankBalance: Boolean(affectsBalance),
        includeInFlatBalance: true,
        attachments
      });

      // 2. Destination account credit (positive transaction)
      transactionsToSave.push({
        id: `t-${uniqueId}-to`,
        date,
        flatNum: flatTarget,
        targetAccount: toAccount,
        amount: numSingleAmount,
        status: "Verified",
        method: "Bank Transfer",
        comment: cleanComment 
          ? `${cleanComment} (${t.dest_credit_note || 'Átvezetés miatti jóváírás'} <- ${fromAccount})` 
          : `${t.dest_credit_note || 'Átvezetés miatti jóváírás'} <- ${fromAccount}`,
        includeInBalance: Boolean(affectsBalance),
        affectsBankBalance: Boolean(affectsBalance),
        includeInFlatBalance: true,
        attachments
      });

      addMultipleItems({
        transactions: transactionsToSave,
        expenses: [],
        debits: []
      });

      if (showToast) showToast(t.transfer_success || "Átvezetés sikeresen rögzítve!", "success");
      setIsSubmitting(false);
      onClose();
      return;
    }

    if (scope === 'multi') {
      const isDebit = txType === 'debit';
      if (selectedCount === 0 || (isDebit ? (numBaseAmount < 0 || baseAmount === '') : numBaseAmount <= 0)) {
        setIsSubmitting(false);
        return;
      }

      const checkedFlatNums = Object.keys(selectedFlats).filter(k => selectedFlats[k]);
      checkedFlatNums.forEach((fNum, idx) => {
        const mult = multipliers[fNum] || 1;
        const itemAmount = Math.round(numBaseAmount * mult);
        const uniqueId = `${timestamp}-${idx}-${Math.random().toString(36).substr(2, 4)}`;

        if (txType === 'payment') {
          transactionsToSave.push({
            id: `t-${uniqueId}`,
            date,
            flatNum: fNum,
            targetAccount,
            amount: itemAmount,
            status: "Verified",
            method: paymentMethod,
            paymentMethod,
            category,
            comment: cleanComment || (isEn ? "Payment" : "Befizetés"),
            includeInBalance: Boolean(affectsBalance),
            affectsBankBalance: Boolean(affectsBalance),
            includeInFlatBalance: true,
            attachments
          });
        } else if (txType === 'expense') {
          expensesToSave.push({
            id: `e-${uniqueId}`,
            date,
            title: cleanComment || (isEn ? `Expense (${fNum})` : `Kiadás (${fNum}. lakás)`),
            provider: cleanComment || targetAccount,
            targetAccount,
            amount: itemAmount,
            category: category || "Utility",
            method: paymentMethod,
            paymentMethod,
            comment: cleanComment,
            flatNum: fNum,
            includeInBalance: Boolean(affectsBalance),
            affectsBankBalance: Boolean(affectsBalance),
            includeInFlatBalance: true,
            attachments
          });
        } else {
          // txType === 'debit'
          debitsToSave.push({
            id: `d-manual-${uniqueId}`,
            flatNum: fNum,
            date,
            targetAccount,
            amount: itemAmount,
            category: category || "Assessment",
            method: paymentMethod,
            paymentMethod,
            title: cleanComment || (isEn ? "Assessment / Debit" : "Előírás / Terhelés"),
            comment: cleanComment || (isEn ? "Assessment / Debit" : "Előírás / Terhelés"),
            includeInBalance: true, // impacts flat balance
            includeInFlatBalance: true,
            affectsBankBalance: Boolean(affectsBalance),
            attachments
          });
        }
      });

    } else if (scope === 'single') {
      const numSingleAmount = Number(singleAmount);
      if (singleAmount === '' || isNaN(numSingleAmount) || numSingleAmount === 0 || !selectedFlatNum) {
        setIsSubmitting(false);
        return;
      }
      const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 4)}`;

      if (txType === 'payment') {
        transactionsToSave.push({
          id: `t-${uniqueId}`,
          date,
          flatNum: selectedFlatNum,
          targetAccount,
          amount: numSingleAmount,
          status: "Verified",
          method: paymentMethod,
          paymentMethod,
          category,
          comment: cleanComment || (isEn ? "Payment" : "Befizetés"),
          includeInBalance: Boolean(affectsBalance),
          affectsBankBalance: Boolean(affectsBalance),
          includeInFlatBalance: true,
          attachments
        });
      } else if (txType === 'expense') {
        expensesToSave.push({
          id: `e-${uniqueId}`,
          date,
          title: cleanComment || (isEn ? `Expense (${selectedFlatNum})` : `Kiadás (${selectedFlatNum}. lakás)`),
          provider: cleanComment || targetAccount,
          targetAccount,
          amount: Math.abs(numSingleAmount),
          category: category || "Utility",
          method: paymentMethod,
          paymentMethod,
          comment: cleanComment,
          flatNum: selectedFlatNum,
          includeInBalance: Boolean(affectsBalance),
          affectsBankBalance: Boolean(affectsBalance),
          includeInFlatBalance: true,
          attachments
        });
      } else {
        // txType === 'debit'
        debitsToSave.push({
          id: `d-manual-${uniqueId}`,
          flatNum: selectedFlatNum,
          date,
          targetAccount,
          amount: Math.abs(numSingleAmount),
          category: category || "Assessment",
          method: paymentMethod,
          paymentMethod,
          title: cleanComment || (isEn ? "Assessment / Debit" : "Előírás / Terhelés"),
          comment: cleanComment || (isEn ? "Assessment / Debit" : "Előírás / Terhelés"),
          includeInBalance: true,
          includeInFlatBalance: true,
          affectsBankBalance: Boolean(affectsBalance),
          attachments
        });
      }

    } else {
      // scope === 'global' (Teljes társasház)
      const numSingleAmount = Number(singleAmount);
      if (singleAmount === '' || isNaN(numSingleAmount) || numSingleAmount === 0) {
        setIsSubmitting(false);
        return;
      }
      const uniqueId = `${timestamp}-${Math.random().toString(36).substr(2, 4)}`;

      if (txType === 'payment') {
        transactionsToSave.push({
          id: `t-${uniqueId}`,
          date,
          flatNum: "Global",
          targetAccount,
          amount: numSingleAmount,
          status: "Verified",
          method: paymentMethod,
          paymentMethod,
          category,
          comment: cleanComment || (targetAccount === "Közös Költség" ? (isEn ? "Common Cost Income" : "Közös Költség bevétel") : targetAccount === "Felújítási Alap" ? (isEn ? "Renovation Fund Income" : "Felújítási Alap bevétel") : (isEn ? `${targetAccount} Income` : `${targetAccount} bevétel`)),
          includeInBalance: Boolean(affectsBalance),
          attachments
        });
      } else if (txType === 'expense') {
        expensesToSave.push({
          id: `e-${uniqueId}`,
          date,
          title: cleanComment || (targetAccount === "Közös Költség" ? (isEn ? "Common Cost Expense" : "Közös Költség kiadás") : (isEn ? "Renovation Fund Expense" : "Felújítási Alap kiadás")),
          provider: cleanComment || targetAccount,
          targetAccount,
          amount: Math.abs(numSingleAmount),
          category: category || "Utility",
          method: paymentMethod,
          paymentMethod,
          comment: cleanComment,
          flatNum: "-",
          includeInBalance: Boolean(affectsBalance),
          attachments
        });
      } else {
        // Global debit
        debitsToSave.push({
          id: `d-manual-${uniqueId}`,
          flatNum: "Global",
          date,
          targetAccount,
          amount: Math.abs(numSingleAmount),
          category: category || "Assessment",
          method: paymentMethod,
          paymentMethod,
          title: cleanComment || (isEn ? "Global Assessment" : "Közös előírás"),
          comment: cleanComment || (isEn ? "Global Assessment" : "Közös előírás"),
          includeInBalance: true,
          affectsBankBalance: Boolean(affectsBalance),
          attachments
        });
      }
    }

    addMultipleItems({
      transactions: transactionsToSave,
      expenses: expensesToSave,
      debits: debitsToSave
    });

    setIsSubmitting(false);
    onClose();
  };

  // Filter flats for multi-flat list search
  const visibleFlats = useMemo(() => {
    if (!flatSearch.trim()) return sortedFlats;
    const q = flatSearch.toLowerCase().trim();
    return sortedFlats.filter(f => {
      if (!f) return false;
      const fn = String(f.flatNum ?? '').toLowerCase();
      const on = String(f.ownerName ?? '').toLowerCase();
      return fn.includes(q) || on.includes(q);
    });
  }, [sortedFlats, flatSearch]);

  const isDebit = txType === 'debit';
  const isSubmitDisabled = txType === 'transfer'
    ? (singleAmount === '' || isNaN(Number(singleAmount)) || Number(singleAmount) === 0 || fromAccount === toAccount || (scope === 'single' && !selectedFlatNum))
    : (scope === 'multi' 
        ? (selectedCount === 0 || (isDebit ? (numBaseAmount < 0 || baseAmount === '') : numBaseAmount <= 0))
        : (singleAmount === '' || isNaN(Number(singleAmount)) || Number(singleAmount) === 0));

  const backdropProps = useBackdropClose(onClose);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-xl sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-scaleUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs flex-shrink-0 ${
              txType === 'payment' 
                ? 'bg-emerald-100 text-emerald-700' 
                : txType === 'expense' 
                  ? 'bg-red-100 text-red-700' 
                  : txType === 'transfer'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-[#1E3A8A]'
            }`}>
              {txType === 'payment' && <PlusCircle className="w-5 h-5" />}
              {txType === 'expense' && <MinusCircle className="w-5 h-5" />}
              {txType === 'debit' && <FileText className="w-5 h-5" />}
              {txType === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 font-display truncate">
                {isEn ? "Universal Item Entry" : "Új tétel rögzítése"}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {txType === 'payment' && (isEn ? "Credit / Payment (+)" : "Jóváírás / Befizetés (+)")}
                {txType === 'expense' && (isEn ? "Debit / Expense (-)" : "Kifizetés / Kiadás (-)")}
                {txType === 'debit' && (isEn ? "Prescription / Assessment" : "Kötelezettség előírása")}
                {txType === 'transfer' && (isEn ? "Inter-account fund transfer" : "Számlák közötti átvezetés")}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            title={t.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 sm:space-y-4">
          
          {/* 1. Type Selector (4-way Segmented Control / Tabs) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
              {isEn ? "Transaction Type" : "Tétel típusa"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-gray-100 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => handleTypeChange('payment')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  txType === 'payment'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-emerald-700 hover:bg-white/60'
                }`}
              >
                <PlusCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{isEn ? "Payment (+)" : "Befizetés (+)"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  txType === 'expense'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-red-700 hover:bg-white/60'
                }`}
              >
                <MinusCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{isEn ? "Expense (-)" : "Kiadás (-)"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('debit')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  txType === 'debit'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-blue-800 hover:bg-white/60'
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{isEn ? "Assessment" : "Előírás"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('transfer')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  txType === 'transfer'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-purple-800 hover:bg-white/60'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t.inter_account_transfer || (isEn ? "Transfer" : "Átvezetés")}</span>
              </button>
            </div>
          </div>

          {/* 2. Scope Selector (Érintett / Hatókör) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
              {isEn ? "Target / Scope" : "Érintett / Hatókör"}
            </label>
            <div className={`grid gap-2 ${txType === 'transfer' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
              <label className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border cursor-pointer transition-all ${
                scope === 'single' ? 'border-[#1E3A8A] bg-blue-50/50 shadow-2xs' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  value="single"
                  checked={scope === 'single'}
                  onChange={() => setScope('single')}
                  className="w-4 h-4 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 truncate">
                    {isEn ? "Single Flat" : "Egy adott lakás"}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {isEn ? "1 unit" : "Egyedi lakás"}
                  </div>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border cursor-pointer transition-all ${
                scope === 'global' ? 'border-[#1E3A8A] bg-blue-50/50 shadow-2xs' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  checked={scope === 'global'}
                  onChange={() => setScope('global')}
                  className="w-4 h-4 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gray-900 truncate">
                    {isEn ? "Entire House" : "Teljes társasház"}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {isEn ? "Common item" : "Közös számlák között"}
                  </div>
                </div>
              </label>

              {txType !== 'transfer' && (
                <label className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border cursor-pointer transition-all ${
                  scope === 'multi' ? 'border-[#1E3A8A] bg-blue-50/50 shadow-2xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="scope"
                    value="multi"
                    checked={scope === 'multi'}
                    onChange={() => setScope('multi')}
                    className="w-4 h-4 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {isEn ? "Multiple Flats" : "Több lakás"}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {isEn ? "Batch & Multipliers" : "Csoportos + szorzó"}
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* 3. Scope Content & Amount */}
          {/* Case A: Single Flat (2-column layout: Unit + Amount) */}
          {scope === 'single' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 bg-gray-50/60 p-2.5 sm:p-3 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  {isEn ? "Select Property Unit" : "Lakás kiválasztása"}
                </label>
                <select
                  value={selectedFlatNum}
                  onChange={(e) => setSelectedFlatNum(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                >
                  {sortedFlats.map(f => (
                    <option key={f.flatNum} value={f.flatNum}>
                      {f.flatNum}. lakás {f.ownerName ? `• ${f.ownerName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 bg-gray-50/60 p-2.5 sm:p-3 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block">
                    {isEn ? "Amount (HUF)" : "Összeg (Ft)"}
                  </label>
                  {oneMonthFeeForSelected > 0 && (
                    <button
                      type="button"
                      onClick={() => setSingleAmount(String(oneMonthFeeForSelected))}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer"
                      title={isEn ? "Fill 1-month prescribed fee" : "1 havi előírt díj beírása"}
                    >
                      {isEn ? `1 mo: ${formatCurrency(oneMonthFeeForSelected)}` : `1 havi: ${formatCurrency(oneMonthFeeForSelected)}`}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    placeholder={isEn ? "e.g. 25 000" : "pl. 25 000"}
                    className="w-full pl-3.5 pr-10 py-2 text-sm font-black text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    Ft
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Case B: Global Condominium item (2-column layout: Info Card + Amount) */}
          {scope === 'global' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-900 flex items-center gap-2.5">
                <Building className="w-5 h-5 text-blue-700 flex-shrink-0" />
                <span className="text-[11px] leading-tight">
                  {isEn 
                    ? "Booked for the entire condominium (no flat assigned)." 
                    : "A teljes társasház szintjén kerül könyvelésre (nem lakáshoz kötött)."}
                </span>
              </div>

              <div className="space-y-1 bg-gray-50/60 p-2.5 sm:p-3 rounded-2xl border border-gray-100 flex flex-col justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 block">
                  {isEn ? "Amount (HUF)" : "Összeg (Ft)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    placeholder={isEn ? "e.g. 25 000" : "pl. 25 000"}
                    className="w-full pl-3.5 pr-10 py-2 text-sm font-black text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    Ft
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Case C: Multi-flat batch selection */}
          {scope === 'multi' && (
            <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl border border-blue-200 bg-blue-50/20">
              
              {/* Base Amount Input for Multi mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                  <span>{isEn ? "Base Amount per Unit (HUF)" : "Alapegység összeg (Ft)"}</span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    {isEn ? "Multiplied per flat" : "Lakásonkénti szorzóval szorzódik"}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={txType === 'debit' ? "0" : "1"}
                    step="1"
                    required
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder={isEn ? "e.g. 70 290" : "pl. 70 290"}
                    className="w-full pl-3.5 pr-10 py-2 text-sm font-black text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    Ft
                  </span>
                </div>
              </div>

              {/* Action bar for flat list */}
              <div className="flex flex-col sm:row sm:items-center justify-between gap-2 pt-1 border-t border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    {isEn ? "Selected units:" : "Kijelölve:"} <strong className="text-gray-900">{selectedCount}</strong> / {sortedFlats.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={handleSelectAllFlats}
                    className="text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                  >
                    {isEn ? "Select all" : "Mindent kijelöl"}
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllFlats}
                    className="text-gray-500 hover:text-gray-800 hover:underline cursor-pointer"
                  >
                    {isEn ? "Deselect all" : "Törlés"}
                  </button>
                </div>
              </div>

              {/* Quick filter for long lists */}
              {sortedFlats.length > 6 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={flatSearch}
                    onChange={(e) => setFlatSearch(e.target.value)}
                    placeholder={isEn ? "Search flat or owner..." : "Keresés albetét/tulajdonos..."}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              )}

              {/* Scrollable list of flats */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white p-1 shadow-2xs">
                {visibleFlats.map(f => {
                  const isChecked = Boolean(selectedFlats[f.flatNum]);
                  const mult = multipliers[f.flatNum] || 1;
                  const itemTotal = numBaseAmount * mult;

                  return (
                    <div 
                      key={f.flatNum} 
                      className={`p-2 sm:p-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                        isChecked ? 'bg-blue-50/40 border border-blue-100/80' : 'hover:bg-gray-50'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFlat(f.flatNum)}
                          className="w-4 h-4 text-[#1E3A8A] rounded focus:ring-[#1E3A8A] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gray-900 block truncate">
                            {f.flatNum}. lakás
                          </span>
                          <span className="text-[11px] text-gray-500 block truncate" title={f.ownerName}>
                            {f.ownerName || '-'}
                          </span>
                        </div>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          {/* Multiplier Stepper: [-] 1x [+] */}
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                            <button
                              type="button"
                              onClick={() => handleStepMultiplier(f.flatNum, -1)}
                              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-white rounded cursor-pointer"
                              title={isEn ? "Decrease multiplier" : "Szorzó csökkentése"}
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-gray-900 font-mono">
                              {mult}x
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStepMultiplier(f.flatNum, 1)}
                              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-white rounded cursor-pointer"
                              title={isEn ? "Increase multiplier" : "Szorzó növelése"}
                            >
                              +
                            </button>
                          </div>

                          {/* Calculated amount */}
                          <div className="text-right min-w-[75px]">
                            <span className="text-xs font-bold text-gray-900 font-display">
                              {formatCurrency(itemTotal)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {visibleFlats.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-400">
                    {isEn ? "No matching flats found" : "Nincs a keresésnek megfelelő lakás"}
                  </div>
                )}
              </div>

              {/* Total calculated summary banner */}
              {selectedCount > 0 && numBaseAmount > 0 && (
                <div className="p-3 rounded-xl bg-blue-100/70 border border-blue-200 flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-900">
                    {isEn ? "Total:" : "Összesen:"} {selectedCount} {isEn ? "flats" : "lakás"} ({totalUnits} {isEn ? "units" : "egység"})
                  </span>
                  <span className="text-sm font-black text-[#1E3A8A] font-display">
                    {formatCurrency(totalCalculatedAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 4. Account & Financial settings */}
          {txType === 'transfer' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Source account */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
                      {t.transfer_from || (isEn ? "From (Source Account)" : "Honnan (Forrás számla)")}
                    </label>
                    <select
                      value={fromAccount}
                      onChange={(e) => setFromAccount(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-600"
                    >
                      <option value="Közös Költség">{t.common_cost}</option>
                      <option value="Felújítási Alap">{t.renovation_fund}</option>
                      {customAccounts.map(acc => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name} {acc.shortName ? `(${acc.shortName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Destination account */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-purple-900 block">
                      {t.transfer_to || (isEn ? "To (Destination Account)" : "Hová (Cél számla)")}
                    </label>
                    <select
                      value={toAccount}
                      onChange={(e) => setToAccount(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-purple-600"
                    >
                      <option value="Felújítási Alap">{t.renovation_fund}</option>
                      <option value="Közös Költség">{t.common_cost}</option>
                      {customAccounts.map(acc => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name} {acc.shortName ? `(${acc.shortName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {fromAccount === toAccount && (
                  <p className="text-xs font-bold text-red-600">
                    {t.transfer_from_to_same_error || (isEn ? "Source and destination accounts cannot be the same!" : "A forrás és a cél számla nem lehet azonos!")}
                  </p>
                )}
              </div>

              {/* Date picker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  {isEn ? "Date" : "Dátum"}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Category & Account Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    {t.category_label || (isEn ? "Category" : "Kategória")}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  >
                    {filteredCategories.map(cat => (
                      <option key={cat.id || cat.name} value={cat.name}>
                        {isEn ? (cat.nameEn || cat.name) : cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account / Fund dropdown */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    {isEn ? "Account / Fund" : "Számla / Alap"}
                  </label>
                  <select
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
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

              {/* Payment Method & Date Row */}
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

                {/* Date picker */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    {isEn ? "Date" : "Dátum"}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  />
                </div>
              </div>

              {/* 5. Smart Bank Balance Impact Checkbox */}
              <div className={`p-3 rounded-2xl border transition-colors ${
                affectsBalance ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affectsBalance}
                    onChange={(e) => setAffectsBalance(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-[#1E3A8A] rounded focus:ring-[#1E3A8A] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-gray-900 block">
                      {isEn ? "Affects bank account balance?" : "Befolyásolja a folyószámla egyenleget?"}
                    </span>
                    <span className="text-[11px] text-gray-500 block leading-tight mt-0.5">
                      {affectsBalance
                        ? (t.smart_balance_hint_bank || (isEn ? "✓ Modifies condominium bank balance and flat ledger" : "✓ Módosítja a ház folyószámla főösszegét és a lakásegyenleget is"))
                        : (t.smart_balance_hint_cash || (isEn ? "✗ Affects flat balance only (bank account total unchanged)" : "✗ Csak a lakás könyvelési egyenlegét módosítja (a banki folyószámla főösszeget nem)"))}
                    </span>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* 8. Description / Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
              {isEn ? "Description / Comment" : "Megjegyzés / Jogcím"}
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                txType === 'debit' 
                  ? (isEn ? "e.g. Extra assessment, renovation fee" : "pl. Rendkívüli felújítási célbefizetés")
                  : txType === 'expense'
                    ? (isEn ? "e.g. Roof leak repair, electricity bill" : "pl. Csőtörés javítása, ELMŰ számla")
                    : (isEn ? "e.g. Bank transfer, common cost payment" : "pl. Banki átutalás, közös költség")
              }
              className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          {/* 9. Attachment / Invoices */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
              {isEn ? "Attachment / Invoice" : "Dokumentum / Számla csatolása"}
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 cursor-pointer transition-colors shadow-2xs">
                <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                <span>{isEn ? "Attach file" : "Fájl feltöltése"}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-gray-400">
                {isEn ? "(PDF, JPG, PNG - max 2 MB)" : "(PDF, kép, max 2 MB)"}
              </span>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1.5">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#1E3A8A]">
                    <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span className="truncate max-w-[140px] font-medium">{file.name}</span>
                    <span className="text-[10px] text-gray-500">({file.size})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-gray-400 hover:text-red-600 ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Potential Duplicate Warning */}
          {potentialDuplicate && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {t.possible_duplicate_title || (isEn ? "Warning: Possible duplicate item detected!" : "Figyelem: Lehetséges duplikált tétel!")}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  {(t.possible_duplicate_desc || (isEn ? "An item with this date, amount, and account already exists in the system:" : "Ezzel a dátummal, összeggel és számlával már szerepel tétel a rendszerben:")) + ` „${potentialDuplicate.comment || potentialDuplicate.title || formatCurrency(potentialDuplicate.amount)}”`}
                </p>
              </div>
            </div>
          )}

          {/* Actions: Submit & Cancel */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.cancel}
            </button>

            <button
              type="submit"
              disabled={isSubmitDisabled || isSubmitting}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer ${
                (isSubmitDisabled || isSubmitting)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : txType === 'payment'
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                    : txType === 'expense'
                      ? 'bg-red-600 hover:bg-red-700 active:scale-95'
                      : txType === 'transfer'
                        ? 'bg-purple-600 hover:bg-purple-700 active:scale-95'
                        : 'bg-[#1E3A8A] hover:bg-[#1e40af] active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving || (isEn ? "Saving..." : "Mentés...")}</span>
                </>
              ) : (
                <>
                  {txType === 'payment' && <PlusCircle className="w-4 h-4" />}
                  {txType === 'expense' && <MinusCircle className="w-4 h-4" />}
                  {txType === 'debit' && <FileText className="w-4 h-4" />}
                  {txType === 'transfer' && <ArrowLeftRight className="w-4 h-4" />}
                  <span>
                    {scope === 'multi'
                      ? (isEn ? `Record for ${selectedCount} flats` : `Rögzítés (${selectedCount} lakás)`)
                      : txType === 'payment'
                        ? (isEn ? "Record Payment" : "Befizetés rögzítése")
                        : txType === 'expense'
                          ? (isEn ? "Record Expense" : "Kiadás rögzítése")
                          : txType === 'transfer'
                            ? (t.inter_account_transfer || (isEn ? "Record Transfer" : "Átvezetés rögzítése"))
                            : (isEn ? "Record Assessment" : "Előírás rögzítése")}
                  </span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
