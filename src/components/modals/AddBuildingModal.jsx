import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Building2, Plus } from 'lucide-react';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { formatTaxNumber } from '../../utils/taxNumber';

export function AddBuildingModal({ isOpen, onClose }) {
  const { state, t, addBuilding } = useApp();
  const isEn = state.currentLang === 'en';
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';

  const [name, setName] = useState('');
  const [officialName, setOfficialName] = useState('');
  const [address, setAddress] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [hrsz, setHrsz] = useState('');
  const [totalOwnershipShare, setTotalOwnershipShare] = useState('10000');
  const [bankKKName, setBankKKName] = useState('');
  const [bankKKBank, setBankKKBank] = useState('OTP');
  const [bankKKAccount, setBankKKAccount] = useState('');
  const [bankFAName, setBankFAName] = useState('');
  const [bankFABank, setBankFABank] = useState('OTP');
  const [bankFAAccount, setBankFAAccount] = useState('');
  const [reserveKK, setReserveKK] = useState('0');
  const [reserveFA, setReserveFA] = useState('0');

  const backdropProps = useBackdropClose(onClose);

  if (!isOpen || !isAdmin) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const buildingId = `b-${Date.now()}`;
    addBuilding({
      id: buildingId,
      name: name.trim(),
      officialName: officialName.trim(),
      address: address.trim(),
      taxNumber: formatTaxNumber(taxNumber).trim(),
      hrsz: hrsz.trim(),
      totalOwnershipShare: parseFloat(String(totalOwnershipShare).replace(',', '.')) || 10000,
      bankKK: {
        name: bankKKName.trim() || officialName.trim() || name.trim(),
        bank: bankKKBank.trim() || 'OTP',
        account: bankKKAccount.trim()
      },
      bankFA: {
        name: bankFAName.trim() || officialName.trim() || name.trim(),
        bank: bankFABank.trim() || 'OTP',
        account: bankFAAccount.trim()
      },
      buildingInitialReserveCommon: Number(reserveKK) || 0,
      buildingInitialReserveRenovation: Number(reserveFA) || 0,
      flats: [],
      transactions: [],
      expenses: [],
      manualDebits: [],
      documents: []
    });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#1E3A8A]" />
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {t.add_building_title}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">{t.bld_settings_name || "Elnevezés"} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Batyu u. 21."
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">{t.bld_settings_official_name || "Hivatalos név"}</label>
            <input
              type="text"
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              placeholder="pl. Batyu utca 21. Társasház"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">{t.bld_settings_address || "Cím"} *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="pl. 1015 Budapest, Batyu utca 21."
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{t.bld_settings_tax_number || "Adószám"}</label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(formatTaxNumber(e.target.value))}
                placeholder="pl. 12345678-1-42"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-mono focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                {t.bld_settings_hrsz || (isEn ? "Land Registry No. (HRSZ)" : "Helyrajzi szám (hrsz.)")}
              </label>
              <input
                type="text"
                value={hrsz}
                onChange={(e) => setHrsz(e.target.value)}
                placeholder={isEn ? "e.g. 12345/0" : "pl. 12345/0"}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-mono focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-gray-700">
                {t.bld_settings_total_share || (isEn ? "Total Ownership Share (Basis)" : "Teljes tulajdoni hányad (Alap)")} *
              </label>
              <span className="text-[10px] text-gray-400">
                {isEn ? "Default: 10,000" : "Alapértelmezett: 10 000"}
              </span>
            </div>
            <input
              type="number"
              step="any"
              min="1"
              value={totalOwnershipShare}
              onChange={(e) => setTotalOwnershipShare(e.target.value)}
              placeholder="10000"
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-mono font-bold focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
              required
            />
            <p className="text-[10px] text-gray-500 mt-1">
              {t.bld_settings_total_share_desc || (isEn 
                ? "Condominium deed basis for voting and shares (typically 10,000, 1,000, 100,000 or custom deed sum)." 
                : "Az alapító okirat szerinti teljes eszmei hányad (általában 10 000, de lehet 1 000, 100 000 vagy egyedi összeg).")}
            </p>
          </div>

          {/* KK Bank */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
            <span className="font-bold text-[#1E3A8A] block">Közös Költség banki adatok</span>
            <input
              type="text"
              value={bankKKName}
              onChange={(e) => setBankKKName(e.target.value)}
              placeholder="Kedvezményezett neve"
              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={bankKKAccount}
                onChange={(e) => setBankKKAccount(e.target.value)}
                placeholder="Bankszámlaszám (11702005 12345678)"
                className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded"
              />
              <input
                type="text"
                value={bankKKBank}
                onChange={(e) => setBankKKBank(e.target.value)}
                placeholder="Bank (OTP)"
                className="w-20 px-2.5 py-1.5 bg-white border border-gray-200 rounded"
              />
            </div>
          </div>

          {/* FA Bank */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
            <span className="font-bold text-purple-700 block">Felújítási Alap banki adatok</span>
            <input
              type="text"
              value={bankFAName}
              onChange={(e) => setBankFAName(e.target.value)}
              placeholder="Kedvezményezett neve"
              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={bankFAAccount}
                onChange={(e) => setBankFAAccount(e.target.value)}
                placeholder="Bankszámlaszám (11702005 87654321)"
                className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded"
              />
              <input
                type="text"
                value={bankFABank}
                onChange={(e) => setBankFABank(e.target.value)}
                placeholder="Bank (OTP)"
                className="w-20 px-2.5 py-1.5 bg-white border border-gray-200 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{t.initial_reserve_kk}</label>
              <input
                type="number"
                value={reserveKK}
                onChange={(e) => setReserveKK(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{t.initial_reserve_fa}</label>
              <input
                type="number"
                value={reserveFA}
                onChange={(e) => setReserveFA(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
              />
            </div>
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
              className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-lg text-xs font-bold hover:bg-[#1e40af] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.create_building_btn}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
