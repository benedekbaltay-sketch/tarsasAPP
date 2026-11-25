import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  X, 
  Landmark, 
  Calculator, 
  Users, 
  Calendar, 
  Percent, 
  Coins, 
  FileText, 
  Building2, 
  Check, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { calculateLoanEndDate, allocateInstallment } from '../../../utils/loans';
import { formatCurrency } from '../../../utils/finances';

export function NewLoanModal({ isOpen, onClose, initialData = null }) {
  const { state, t, addLoan, updateLoan } = useApp();
  const { flats = [], currentLang } = state;
  const isEn = currentLang === 'en';

  const isEdit = Boolean(initialData && initialData.id);

  // Core Form state
  const [title, setTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [totalProjectCost, setTotalProjectCost] = useState('');
  const [termMonths, setTermMonths] = useState('60');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [allocationType, setAllocationType] = useState('ownership_ratio');
  const [status, setStatus] = useState('active');

  // Participants state
  const [participants, setParticipants] = useState([]);
  const [errors, setErrors] = useState({});

  // Auto-calculate expected end date when start date or term changes
  useEffect(() => {
    if (startDate && termMonths) {
      const calcEnd = calculateLoanEndDate(startDate, termMonths);
      setEndDate(calcEnd);
    }
  }, [startDate, termMonths]);

  // Helper to initialize participants from current building flats
  const initDefaultParticipants = (projectCost) => {
    const cost = Number(projectCost) || 0;
    const totalArea = flats.reduce((sum, f) => sum + (Number(f.area) || 1), 0) || 1;

    const list = (flats || []).map(f => {
      const flatArea = Number(f.area) || 1;
      const share = flatArea / totalArea;
      const initialShareCost = Math.round(cost * share);

      return {
        apartmentId: String(f.flatNum),
        ownerName: f.ownerName || (f.owners?.[0]?.name) || (isEn ? "Owner" : "Tulajdonos"),
        paymentMethod: 'financed', // default all financed
        lumpSumAmountPaid: initialShareCost,
        monthlyContribution: 0,
        area: flatArea
      };
    });
    setParticipants(list);
  };

  // Initialize form
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      return;
    }

    if (isEdit && initialData) {
      setTitle(initialData.title || '');
      setBankName(initialData.bankName || '');
      setContractNumber(initialData.contractNumber || '');
      setTotalProjectCost(initialData.totalProjectCost ? String(initialData.totalProjectCost) : '');
      setTermMonths(initialData.termMonths ? String(initialData.termMonths) : '60');
      setStartDate(initialData.startDate || new Date().toISOString().slice(0, 10));
      setEndDate(initialData.endDate || '');
      setMonthlyInstallment(initialData.monthlyInstallment ? String(initialData.monthlyInstallment) : '');
      setInterestRatePercent(initialData.interestRatePercent ? String(initialData.interestRatePercent) : '');
      setAllocationType(initialData.allocationType || 'ownership_ratio');
      setStatus(initialData.status || 'active');

      if (Array.isArray(initialData.participants) && initialData.participants.length > 0) {
        setParticipants(initialData.participants);
      } else {
        initDefaultParticipants(initialData.totalProjectCost || 0);
      }
    } else {
      // New loan defaults
      setTitle('');
      setBankName('OTP Bank');
      setContractNumber('');
      setTotalProjectCost('');
      setTermMonths('60');
      const todayStr = new Date().toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(calculateLoanEndDate(todayStr, 60));
      setMonthlyInstallment('');
      setInterestRatePercent('');
      setAllocationType('ownership_ratio');
      setStatus('active');
      initDefaultParticipants(0);
    }
    setErrors({});
  }, [isOpen, initialData, isEdit]);



  // Recalculate monthly contribution allocations whenever participants or installment or allocationType changes
  const computedParticipants = useMemo(() => {
    return allocateInstallment(monthlyInstallment, participants, allocationType, flats);
  }, [monthlyInstallment, participants, allocationType, flats]);

  // Aggregate calculations
  const lumpSumTotalCollected = useMemo(() => {
    return participants.reduce((sum, p) => {
      return sum + (p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0);
    }, 0);
  }, [participants]);

  const principalAmount = useMemo(() => {
    const cost = Number(totalProjectCost) || 0;
    return Math.max(0, cost - lumpSumTotalCollected);
  }, [totalProjectCost, lumpSumTotalCollected]);

  const financedCount = useMemo(() => {
    return participants.filter(p => p.paymentMethod === 'financed').length;
  }, [participants]);

  const lumpSumCount = useMemo(() => {
    return participants.filter(p => p.paymentMethod === 'lump_sum').length;
  }, [participants]);

  // Handlers for participant changes
  const handleTogglePaymentMethod = (index, method) => {
    setParticipants(prev => {
      const next = [...prev];
      const p = { ...next[index], paymentMethod: method };
      
      // If switched to lump_sum and amount is 0, auto-estimate based on area
      if (method === 'lump_sum' && (!p.lumpSumAmountPaid || p.lumpSumAmountPaid === 0)) {
        const totalArea = flats.reduce((sum, f) => sum + (Number(f.area) || 1), 0) || 1;
        const area = Number(p.area) || 1;
        p.lumpSumAmountPaid = Math.round((Number(totalProjectCost) || 0) * (area / totalArea));
      }
      next[index] = p;
      return next;
    });
  };

  const handleLumpSumChange = (index, value) => {
    setParticipants(prev => {
      const next = [...prev];
      next[index] = { ...next[index], lumpSumAmountPaid: Math.max(0, Number(value) || 0) };
      return next;
    });
  };

  const handleManualMonthlyChange = (index, value) => {
    setParticipants(prev => {
      const next = [...prev];
      next[index] = { ...next[index], monthlyContribution: Math.max(0, Number(value) || 0) };
      return next;
    });
  };

  const handleSetAllMethod = (method) => {
    const totalArea = flats.reduce((sum, f) => sum + (Number(f.area) || 1), 0) || 1;
    const cost = Number(totalProjectCost) || 0;

    setParticipants(prev => prev.map(p => {
      const area = Number(p.area) || 1;
      return {
        ...p,
        paymentMethod: method,
        lumpSumAmountPaid: method === 'lump_sum' ? Math.round(cost * (area / totalArea)) : (p.lumpSumAmountPaid || 0)
      };
    }));
  };

  // Validation & Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!title.trim()) newErrors.title = isEn ? "Title is required" : "A megnevezés megadása kötelező";
    if (!totalProjectCost || Number(totalProjectCost) <= 0) {
      newErrors.totalProjectCost = isEn ? "Valid project cost required" : "Valós projektösszeg megadása kötelező";
    }
    if (!termMonths || Number(termMonths) <= 0) {
      newErrors.termMonths = isEn ? "Term in months required" : "Futamidő megadása kötelező";
    }
    if (!startDate) newErrors.startDate = isEn ? "Start date required" : "Kezdő dátum kötelező";

    if (financedCount > 0 && (!monthlyInstallment || Number(monthlyInstallment) <= 0)) {
      newErrors.monthlyInstallment = isEn ? "Monthly installment required" : "Havi törlesztő megadása kötelező";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      title: title.trim(),
      bankName: bankName.trim(),
      contractNumber: contractNumber.trim(),
      totalProjectCost: Number(totalProjectCost),
      lumpSumTotalCollected,
      principalAmount,
      currentBalance: isEdit ? initialData.currentBalance : principalAmount,
      termMonths: Number(termMonths),
      startDate,
      endDate: endDate || calculateLoanEndDate(startDate, termMonths),
      monthlyInstallment: Number(monthlyInstallment) || 0,
      interestRatePercent: Number(interestRatePercent) || 0,
      allocationType,
      status,
      participants: computedParticipants
    };

    if (isEdit) {
      updateLoan(initialData.id, payload).then(() => onClose());
    } else {
      addLoan(payload).then(() => onClose());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full my-auto shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-display">
                {isEdit 
                  ? (isEn ? "Edit Condominium Loan" : "Társasházi hitel szerkesztése")
                  : (isEn ? "Record New Condominium Loan" : "Új társasházi hitel rögzítése")
                }
              </h3>
              <p className="text-xs text-gray-500">
                {isEn ? "Financing, repayment schedule and resident allocation" : "Finanszírozás, törlesztési ütemterv és lakói leosztás"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable Form) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Basic Information */}
          <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/70 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <Building2 className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                {isEn ? "1. Loan & Project Details" : "1. Hitel és projekt alapadatok"}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Project / Loan Title" : "Projekt / Hitel megnevezése"} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isEn ? "e.g. Boiler replacement and thermal center upgrade" : "pl. Kazáncsere és hőközpont korszerűsítés"}
                  className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
                    errors.title ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                  }`}
                />
                {errors.title && <p className="text-[11px] text-red-500 mt-0.5">{errors.title}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Status" : "Státusz"}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="active">{isEn ? "Active" : "Aktív (folyamatban)"}</option>
                  <option value="draft">{isEn ? "Draft / Planning" : "Tervezet / Előkészület"}</option>
                  <option value="paid_off">{isEn ? "Paid Off / Closed" : "Lezárt / Kifizetett"}</option>
                </select>
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Lending Bank" : "Hitelező bank"}
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="pl. OTP Bank, Erste, MBH"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Contract Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Contract Number" : "Szerződésszám / Iktatószám"}
                </label>
                <input
                  type="text"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="pl. OTP-2024-KZ-089"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Total Project Cost */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Total Project Cost (HUF)" : "Teljes projektköltség (Ft)"} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={totalProjectCost}
                    onChange={(e) => setTotalProjectCost(e.target.value)}
                    placeholder="pl. 15000000"
                    className={`w-full px-3 py-2 text-sm font-semibold bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
                      errors.totalProjectCost ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Ft</span>
                </div>
                {errors.totalProjectCost && <p className="text-[11px] text-red-500 mt-0.5">{errors.totalProjectCost}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Repayment & Financials */}
          <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/70 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <Calculator className="w-4 h-4 text-purple-600" />
              <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                {isEn ? "2. Repayment Schedule & Interest" : "2. Futamidő, törlesztés és kamat"}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Start Date" : "Kezdő dátum (folyósítás)"} *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Term (Months) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Term (Months)" : "Futamidő (Hónap)"} *
                </label>
                <input
                  type="number"
                  min="1"
                  max="360"
                  required
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  placeholder="60"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* End Date (Auto-calculated) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Expected Maturity Date" : "Várható lejárat"}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-purple-50/50 border border-purple-200 text-purple-900 font-semibold rounded-xl focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {isEn ? "Auto-computed from term" : "Automatikusan számítva"}
                </span>
              </div>

              {/* Interest Rate */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Interest Rate (%)" : "Kamatláb (% / év)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={interestRatePercent}
                    onChange={(e) => setInterestRatePercent(e.target.value)}
                    placeholder="pl. 7.95"
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                </div>
              </div>

              {/* Monthly Installment */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Total Monthly Bank Installment (HUF)" : "Bank felé fizetendő havi törlesztőrészlet (Ft)"} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={monthlyInstallment}
                    onChange={(e) => setMonthlyInstallment(e.target.value)}
                    placeholder="pl. 285000"
                    className={`w-full px-3 py-2 text-sm font-bold text-purple-900 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
                      errors.monthlyInstallment ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Ft / hó</span>
                </div>
                {errors.monthlyInstallment && <p className="text-[11px] text-red-500 mt-0.5">{errors.monthlyInstallment}</p>}
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  {isEn ? "This total installment will be allocated only to financed residents." : "Kizárólag a hitelben maradó lakók között kerül szétosztásra."}
                </span>
              </div>

              {/* Allocation Type */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isEn ? "Installment Allocation Method" : "Törlesztő szétosztási módja"}
                </label>
                <select
                  value={allocationType}
                  onChange={(e) => setAllocationType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="ownership_ratio">
                    {isEn ? "Proportional to Area / Ownership Share (Standard)" : "Tulajdoni hányad / m² arányában (Standard)"}
                  </option>
                  <option value="equal">
                    {isEn ? "Equally among financed residents" : "Egyenlő arányban a résztvevők között"}
                  </option>
                  <option value="fixed_amount">
                    {isEn ? "Custom fixed amount per resident" : "Egyedi fix összeg lakásonként"}
                  </option>
                </select>
              </div>
            </div>

            {/* Live Calculation Pill Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-purple-50/80 rounded-xl border border-purple-200/70 text-xs">
              <div>
                <span className="text-gray-500 block">{isEn ? "Total Project Cost:" : "Teljes projekt költség:"}</span>
                <span className="font-bold text-gray-900 text-sm">{formatCurrency(Number(totalProjectCost) || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{isEn ? "Lump Sum Equity Collected:" : "Befolyt egyösszegű önrész:"}</span>
                <span className="font-bold text-emerald-700 text-sm">+{formatCurrency(lumpSumTotalCollected)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">{isEn ? "Actual Bank Loan Needed:" : "Ténylegesen felvett bankhitel:"}</span>
                <span className="font-extrabold text-purple-900 text-sm">{formatCurrency(principalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Participants & Exemption Breakdown */}
          <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                  {isEn ? "3. Resident Participation & Exemption" : "3. Lakói részvétel és mentesülések"}
                </h4>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllMethod('financed')}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 cursor-pointer transition-colors"
                >
                  {isEn ? "All Financed" : "Mindenki hitelből"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllMethod('lump_sum')}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 cursor-pointer transition-colors"
                >
                  {isEn ? "All Lump Sum" : "Mindenki zsebből"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                {isEn ? "Financed:" : "Hitelből törlesztő:"} <strong className="text-purple-700">{financedCount} lakás</strong>
              </span>
              <span>
                {isEn ? "Lump-sum exempt:" : "Zsebből fizetett (mentesült):"} <strong className="text-emerald-700">{lumpSumCount} lakás</strong>
              </span>
            </div>

            {/* Participants Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0 z-1">
                    <tr>
                      <th className="py-2.5 px-3">{isEn ? "Flat" : "Lakás"}</th>
                      <th className="py-2.5 px-3">{isEn ? "Owner" : "Tulajdonos"}</th>
                      <th className="py-2.5 px-3 text-center">{isEn ? "Payment Method" : "Fizetési mód"}</th>
                      <th className="py-2.5 px-3 text-right">{isEn ? "Lump Sum Paid" : "Zsebből fizetett"}</th>
                      <th className="py-2.5 px-3 text-right">{isEn ? "Monthly Contribution" : "Havi rá eső törlesztő"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {computedParticipants.map((p, idx) => {
                      const isLump = p.paymentMethod === 'lump_sum';
                      return (
                        <tr key={p.apartmentId || idx} className={`hover:bg-gray-50/80 transition-colors ${isLump ? 'bg-emerald-50/20' : ''}`}>
                          <td className="py-2.5 px-3 font-bold text-gray-900 whitespace-nowrap">
                            {p.apartmentId}. {isEn ? "flat" : "lakás"}
                            {p.area ? <span className="text-[10px] text-gray-400 font-normal ml-1">({p.area} m²)</span> : null}
                          </td>
                          <td className="py-2.5 px-3 text-gray-700 truncate max-w-[140px]">
                            {p.ownerName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex rounded-lg p-0.5 bg-gray-100 border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleTogglePaymentMethod(idx, 'financed')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  !isLump 
                                    ? 'bg-purple-600 text-white shadow-xs' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                {isEn ? "Financed" : "Hitelből"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTogglePaymentMethod(idx, 'lump_sum')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  isLump 
                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                {isEn ? "Lump Sum" : "Zsebből"}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isLump ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  value={p.lumpSumAmountPaid || ''}
                                  onChange={(e) => handleLumpSumChange(idx, e.target.value)}
                                  className="w-24 text-right px-2 py-1 border border-emerald-300 rounded text-xs font-semibold text-emerald-800 bg-emerald-50/50 focus:bg-white focus:outline-none"
                                />
                                <span className="text-[10px] text-gray-400">Ft</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-display whitespace-nowrap">
                            {!isLump ? (
                              allocationType === 'fixed_amount' ? (
                                <div className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={p.monthlyContribution || ''}
                                    onChange={(e) => handleManualMonthlyChange(idx, e.target.value)}
                                    className="w-20 text-right px-2 py-1 border border-purple-300 rounded text-xs font-bold text-purple-900 bg-purple-50/50 focus:bg-white focus:outline-none"
                                  />
                                  <span className="text-[10px] text-gray-400">Ft/hó</span>
                                </div>
                              ) : (
                                <span className="font-bold text-purple-900 text-xs">
                                  {formatCurrency(p.monthlyContribution || 0)}/hó
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                {isEn ? "Exempt" : "Mentesült"}
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
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold cursor-pointer transition-colors"
            >
              {isEn ? "Cancel" : "Mégse"}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>{isEdit ? (isEn ? "Save Changes" : "Módosítások mentése") : (isEn ? "Create Loan" : "Hitel létrehozása")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
