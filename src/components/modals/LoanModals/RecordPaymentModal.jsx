import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { 
  X, 
  Coins, 
  Check, 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  Percent, 
  Receipt 
} from 'lucide-react';
import { formatCurrency } from '../../../utils/finances';

export function RecordPaymentModal({ isOpen, onClose, loan }) {
  const { state, recordLoanPayment } = useApp();
  const isEn = state.currentLang === 'en';

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [principalPaid, setPrincipalPaid] = useState('');
  const [interestPaid, setInterestPaid] = useState('');
  const [bankFee, setBankFee] = useState('');
  const [totalPaid, setTotalPaid] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('completed');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(new Date().toISOString().slice(0, 10));
      // Pre-fill with loan monthly installment if available
      const inst = Number(loan?.monthlyInstallment) || 0;
      if (inst > 0) {
        // Rough default: 80% principal, 20% interest if not specified
        const defPrin = Math.round(inst * 0.8);
        const defInt = inst - defPrin;
        setPrincipalPaid(String(defPrin));
        setInterestPaid(String(defInt));
        setBankFee('0');
        setTotalPaid(String(inst));
      } else {
        setPrincipalPaid('');
        setInterestPaid('');
        setBankFee('0');
        setTotalPaid('');
      }
      setNote('');
      setStatus('completed');
      setErrors({});
    }
  }, [isOpen, loan]);

  // Keep totalPaid in sync when principal, interest or fee changes
  const handlePrincipalChange = (val) => {
    setPrincipalPaid(val);
    const p = Number(val) || 0;
    const i = Number(interestPaid) || 0;
    const f = Number(bankFee) || 0;
    setTotalPaid(String(p + i + f));
  };

  const handleInterestChange = (val) => {
    setInterestPaid(val);
    const p = Number(principalPaid) || 0;
    const i = Number(val) || 0;
    const f = Number(bankFee) || 0;
    setTotalPaid(String(p + i + f));
  };

  const handleFeeChange = (val) => {
    setBankFee(val);
    const p = Number(principalPaid) || 0;
    const i = Number(interestPaid) || 0;
    const f = Number(val) || 0;
    setTotalPaid(String(p + i + f));
  };

  if (!isOpen || !loan) return null;

  const currentBal = Number(loan.currentBalance) || 0;
  const numPrincipalPaid = Number(principalPaid) || 0;
  const remainingBalanceAfter = Math.max(0, currentBal - numPrincipalPaid);
  const isPayoff = remainingBalanceAfter <= 0 && currentBal > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!paymentDate) newErrors.paymentDate = isEn ? "Date is required" : "A dátum megadása kötelező";
    if (numPrincipalPaid <= 0 && (Number(interestPaid) || 0) <= 0) {
      newErrors.principalPaid = isEn ? "Payment amount must be greater than 0" : "A törlesztési összegnek 0-nál nagyobbnak kell lennie";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      paymentDate,
      totalPaid: Number(totalPaid) || (numPrincipalPaid + (Number(interestPaid) || 0) + (Number(bankFee) || 0)),
      principalPaid: numPrincipalPaid,
      interestPaid: Number(interestPaid) || 0,
      bankFee: Number(bankFee) || 0,
      remainingBalanceAfter,
      status,
      note: note.trim()
    };

    recordLoanPayment(loan.id, payload).then(() => {
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full my-auto shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50/30 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-display">
                {isEn ? "Record Bank Loan Payment" : "Havi banki törlesztés rögzítése"}
              </h3>
              <p className="text-xs text-gray-500 truncate max-w-[240px] sm:max-w-xs">
                {loan.title}
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Current Debt Banner */}
          <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs">
            <div>
              <span className="text-gray-500 block">{isEn ? "Current Remaining Balance:" : "Jelenlegi tőketartozás:"}</span>
              <span className="text-base font-extrabold text-gray-900 font-display">
                {formatCurrency(currentBal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 block">{isEn ? "Balance After Payment:" : "Törlesztés utáni tőke:"}</span>
              <span className={`text-base font-extrabold font-display ${isPayoff ? 'text-emerald-600' : 'text-purple-700'}`}>
                {formatCurrency(remainingBalanceAfter)}
              </span>
            </div>
          </div>

          {/* Payoff Alert */}
          {isPayoff && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold animate-pulse">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                {isEn 
                  ? "This payment will fully pay off the loan! Status will automatically change to Paid Off." 
                  : "Ez a törlesztés teljesen rendezi a fennmaradó hitelt! A státusz automatikusan 'Lezárt'-ra vált."}
              </span>
            </div>
          )}

          {/* Payment Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {isEn ? "Payment Date" : "Befizetés dátuma"} *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {isEn ? "Status" : "Státusz"}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
              >
                <option value="completed">{isEn ? "Completed" : "Teljesítve (Könyvelve)"}</option>
                <option value="pending">{isEn ? "Pending / Scheduled" : "Függőben / Tervezett"}</option>
              </select>
            </div>
          </div>

          {/* Breakdown: Principal, Interest, Bank Fee */}
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
            <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-purple-600" />
              <span>{isEn ? "Payment Breakdown" : "Törlesztő részletezése"}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Principal Paid */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  {isEn ? "Principal (HUF)" : "Tőketörlesztés (Ft)"} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={principalPaid}
                  onChange={(e) => handlePrincipalChange(e.target.value)}
                  placeholder="pl. 220000"
                  className={`w-full px-2.5 py-1.5 text-sm font-bold text-gray-900 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 ${
                    errors.principalPaid ? 'border-red-400 bg-red-50/30' : 'border-gray-300'
                  }`}
                />
              </div>

              {/* Interest Paid */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  {isEn ? "Interest (HUF)" : "Kamat (Ft)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={interestPaid}
                  onChange={(e) => handleInterestChange(e.target.value)}
                  placeholder="pl. 60000"
                  className="w-full px-2.5 py-1.5 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Bank Fee */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  {isEn ? "Bank Fee (HUF)" : "Banki díj / Költség (Ft)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={bankFee}
                  onChange={(e) => handleFeeChange(e.target.value)}
                  placeholder="pl. 5000"
                  className="w-full px-2.5 py-1.5 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Total Paid */}
            <div className="pt-2 border-t border-purple-200/50 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">
                {isEn ? "Total Amount Debited from Account:" : "Számláról levont teljes összeg:"}
              </span>
              <span className="text-sm font-extrabold text-purple-900 font-display">
                {formatCurrency(Number(totalPaid) || 0)}
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {isEn ? "Note / Reference" : "Megjegyzés / Közlemény"}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isEn ? "e.g. October 2024 installment" : "pl. 2024. október havi esedékes törlesztés"}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Submit buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold cursor-pointer transition-colors"
            >
              {isEn ? "Cancel" : "Mégse"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>{isEn ? "Save Payment" : "Törlesztés rögzítése"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
