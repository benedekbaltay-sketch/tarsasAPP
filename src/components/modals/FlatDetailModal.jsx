import React, { useState } from 'react';
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
  Users,
  Calendar
} from 'lucide-react';
import { 
  formatCurrency, 
  getCurrentFee, 
  getCombinedFlatLedgerTimeline 
} from '../../utils/finances';

export function FlatDetailModal({
  flatNum,
  isOpen,
  onClose,
  onOpenAddTx,
  onOpenFullscreen,
  onOpenDeleteTx
}) {
  const { state, t, updateFlatFees } = useApp();
  const { flats, currentLang } = state;
  const isEn = currentLang === 'en';

  const [isEditMode, setIsEditMode] = useState(false);
  const [feeA, setFeeA] = useState('');
  const [feeB, setFeeB] = useState('');
  const [feeDateA, setFeeDateA] = useState('');
  const [feeDateB, setFeeDateB] = useState('');

  if (!isOpen || !flatNum) return null;

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
  const timeline = getCombinedFlatLedgerTimeline(flatNum, state);

  const startEditMode = () => {
    setFeeA(curFeeA.toString());
    setFeeB(curFeeB.toString());
    setFeeDateA('');
    setFeeDateB('');
    setIsEditMode(true);
  };

  const handleSaveFees = (e) => {
    e.preventDefault();
    updateFlatFees(flatNum, feeA, feeB, feeDateA || null, feeDateB || null);
    setIsEditMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate font-display">
              {flat.flatNum}. {isEn ? "Flat Details" : "Lakás adatlap"}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onOpenAddTx(flat.flatNum)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isEn ? "New Item" : "Új tétel"}</span>
            </button>

            <button
              onClick={startEditMode}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
              title="Adatok szerkesztése"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
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
          <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 flex flex-wrap items-center gap-4 sm:gap-8 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                {t.owner_name}
              </span>
              <span className="font-bold text-gray-900 text-sm">{flat.ownerName}</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                {t.email}
              </span>
              <span className="font-semibold text-gray-700">{flat.email || "-"}</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                {t.tenant_count}
              </span>
              <span className="font-semibold text-gray-700">{flat.tenantCount || 1} {isEn ? "persons" : "fő"}</span>
            </div>
          </div>

          {/* Balances & Fees Row */}
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
              <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
                <span className="text-[11px] font-medium text-gray-500 block">{t.monthly_kk_fee}</span>
                <span className="text-base font-extrabold text-[#1E3A8A] font-display">
                  {formatCurrency(curFeeA)}
                </span>
              </div>
              <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3">
                <span className="text-[11px] font-medium text-gray-500 block">{t.monthly_fa_fee}</span>
                <span className="text-base font-extrabold text-purple-700 font-display">
                  {formatCurrency(curFeeB)}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveFees} className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
                {isEn ? "Edit Monthly Fees" : "Havi előírások módosítása"}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* KK Fee */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.monthly_kk_fee}</label>
                  <input
                    type="number"
                    value={feeA}
                    onChange={(e) => setFeeA(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
                    required
                  />
                  <div className="mt-2 bg-white/70 p-2 rounded-lg border border-gray-200">
                    <label className="block text-[11px] text-gray-500 mb-1">{t.effective_from}</label>
                    <input
                      type="month"
                      value={feeDateA}
                      onChange={(e) => setFeeDateA(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
                    />
                  </div>
                </div>

                {/* FA Fee */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t.monthly_fa_fee}</label>
                  <input
                    type="number"
                    value={feeB}
                    onChange={(e) => setFeeB(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold"
                    required
                  />
                  <div className="mt-2 bg-white/70 p-2 rounded-lg border border-gray-200">
                    <label className="block text-[11px] text-gray-500 mb-1">{t.effective_from}</label>
                    <input
                      type="month"
                      value={feeDateB}
                      onChange={(e) => setFeeDateB(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-3 py-1.5 border border-gray-300 bg-white rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-lg text-xs font-bold hover:bg-[#1e40af]"
                >
                  {t.save}
                </button>
              </div>
            </form>
          )}

          {/* Ledger Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">{t.tx_and_fees_title}</span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100 sticky top-0 bg-white">
                  <tr>
                    <th className="py-2.5 px-3">{t.th_date}</th>
                    <th className="py-2.5 px-3">{t.th_comment}</th>
                    <th className="py-2.5 px-3 text-right">{t.th_amount}</th>
                    <th className="py-2.5 px-3 text-right">{t.th_balance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {timeline.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-gray-400">
                        {isEn ? "No records" : "Nincs tétel"}
                      </td>
                    </tr>
                  ) : (
                    timeline.slice(0, 8).map((item) => {
                      const isDebit = item.type === "Debit";
                      return (
                        <tr key={item.id} className="hover:bg-gray-50/70">
                          <td className="py-2 px-3 font-mono text-gray-500 whitespace-nowrap">{item.date}</td>
                          <td className="py-2 px-3 text-gray-800">{item.comment}</td>
                          <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDebit ? 'text-gray-900' : 'text-emerald-600'}`}>
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-gray-500 whitespace-nowrap">
                            {formatCurrency(item.runningBalance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {timeline.length > 8 && (
              <div className="p-2.5 text-center bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => {
                    onClose();
                    onOpenFullscreen('flat', flat.flatNum);
                  }}
                  className="text-xs font-bold text-[#1E3A8A] hover:underline"
                >
                  {isEn ? "View all transactions" : "Minden tranzakció megjelenítése"} ({timeline.length})
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>

      </div>
    </div>
  );
}
