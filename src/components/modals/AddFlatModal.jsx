import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Plus, Home } from 'lucide-react';

export function AddFlatModal({ isOpen, onClose }) {
  const { state, t, addFlat } = useApp();
  const { currentLang } = state;
  const isEn = currentLang === 'en';

  const [flatNum, setFlatNum] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [renovationFee, setRenovationFee] = useState('');
  const [ownershipShare, setOwnershipShare] = useState('');
  const [area, setArea] = useState('');
  const [terrace, setTerrace] = useState('');
  const [garage, setGarage] = useState('');
  const [tenantCount, setTenantCount] = useState('1');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!flatNum.trim() || !ownerName.trim()) return;

    const garagesList = garage.trim() 
      ? garage.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    addFlat({
      flatNum: flatNum.trim(),
      ownerName: ownerName.trim(),
      email: email.trim(),
      monthlyFee: Number(monthlyFee) || 0,
      renovationFee: Number(renovationFee) || 0,
      ownershipShare: parseFloat(ownershipShare) || 0,
      area: parseFloat(area) || 0,
      terraceArea: parseFloat(terrace) || 0,
      garages: garagesList,
      tenantCount: parseInt(tenantCount, 10) || 1,
      balance: 0,
      renovationBalance: 0,
      feeChangesKK: [],
      feeChangesFA: [],
      cancelledDebits: []
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {t.add_flat_title}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.flat_num}</label>
            <input
              type="text"
              value={flatNum}
              onChange={(e) => setFlatNum(e.target.value)}
              placeholder="pl. III 12"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.owner_name}</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="pl. Kiss János"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.owner_email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pl. kiss.janos@gmail.com"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.monthly_fee}</label>
              <input
                type="number"
                min="0"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="20000"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.renovation_fee}</label>
              <input
                type="number"
                min="0"
                value={renovationFee}
                onChange={(e) => setRenovationFee(e.target.value)}
                placeholder="5000"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.ownership_percentage}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ownershipShare}
                onChange={(e) => setOwnershipShare(e.target.value)}
                placeholder="10.5"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{t.tenant_count_persons}</label>
              <input
                type="number"
                min="1"
                value={tenantCount}
                onChange={(e) => setTenantCount(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Alapterület (m²)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="pl. 64"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Terasz / Loggia (m²)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={terrace}
                onChange={(e) => setTerrace(e.target.value)}
                placeholder="pl. 8.5"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Garázs(ok) mérete (m²)</label>
            <input
              type="text"
              value={garage}
              onChange={(e) => setGarage(e.target.value)}
              placeholder="pl. 16 vagy több esetén: 15, 18"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.add}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
