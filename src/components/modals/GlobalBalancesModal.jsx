import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Save } from 'lucide-react';
import { getBuildingReserve, getBuildingRenovationFund, parseCleanNumber } from '../../utils/finances';

export function GlobalBalancesModal({ isOpen, onClose }) {
  const { state, t, setGlobalBalances } = useApp();
  const { currentLang } = state;
  const isEn = currentLang === 'en';

  const [commonBalance, setCommonBalance] = useState('');
  const [renovationBalance, setRenovationBalance] = useState('');

  useEffect(() => {
    if (isOpen) {
      const curKK = getBuildingReserve(state);
      const curFA = getBuildingRenovationFund(state);
      setCommonBalance(Math.round(curKK).toString());
      setRenovationBalance(Math.round(curFA).toString());
    }
  }, [isOpen, state]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCommon = parseCleanNumber(commonBalance);
    const cleanRenovation = parseCleanNumber(renovationBalance);
    setGlobalBalances(cleanCommon, cleanRenovation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <h3 className="text-sm font-bold text-gray-900 font-display">
            {t.set_balances_title}
          </h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            {isEn 
              ? "Specify the CURRENT bank account balances. The system calculates starting balances accordingly so all past and future transactions stay accurate."
              : "Add meg, hogy jelenleg pontosan mennyi pénz van a bankszámlákon. A rendszer ez alapján visszaszámolja az induló egyenleget a háttérben, így a jövőbeli tranzakciók továbbra is hibátlanul fognak hozzáadódni."}
          </p>

          <div>
            <label className="block text-xs font-bold text-[#1E3A8A] mb-1">
              {t.global_start_common}
            </label>
            <input
              type="text"
              value={commonBalance}
              onChange={(e) => setCommonBalance(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-purple-700 mb-1">
              {t.global_start_renovation}
            </label>
            <input
              type="text"
              value={renovationBalance}
              onChange={(e) => setRenovationBalance(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-900"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t.save}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
