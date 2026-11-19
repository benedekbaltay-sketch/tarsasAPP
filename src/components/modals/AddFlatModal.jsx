import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Plus, Home, Users, User, Trash2, Mail, Phone } from 'lucide-react';
import { formatPhoneNumber } from '../../utils/phone';
import { formatAnnexItem } from '../../utils/annex';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function AddFlatModal({ isOpen, onClose }) {
  const { state, t, addFlat } = useApp();
  const { currentLang } = state;
  const isEn = currentLang === 'en';

  const [flatNum, setFlatNum] = useState('');
  const [owners, setOwners] = useState([{ name: '', share: '', email: '', phone: '' }]);
  const [monthlyFee, setMonthlyFee] = useState('');
  const [renovationFee, setRenovationFee] = useState('');
  const [ownershipShare, setOwnershipShare] = useState('');
  const [area, setArea] = useState('');
  const [terrace, setTerrace] = useState('');
  const [garages, setGarages] = useState([]);
  const [storages, setStorages] = useState([]);
  const [tenantCount, setTenantCount] = useState('1');

  const backdropProps = useBackdropClose(onClose);

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !isAdmin) return null;

  const handleAddOwner = () => {
    setOwners(prev => [...prev, { name: '', share: '', email: '', phone: '' }]);
  };

  const handleRemoveOwner = (index) => {
    if (owners.length <= 1) return;
    setOwners(prev => prev.filter((_, i) => i !== index));
  };

  const handleOwnerChange = (index, field, value) => {
    setOwners(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleOwnerPhoneBlur = (index) => {
    setOwners(prev => {
      const next = [...prev];
      if (next[index]?.phone) {
        next[index] = { ...next[index], phone: formatPhoneNumber(next[index].phone) };
      }
      return next;
    });
  };

  const handleAddGarage = () => {
    setGarages(prev => [...prev, { number: '', area: '' }]);
  };

  const handleRemoveGarage = (index) => {
    setGarages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGarageChange = (index, field, value) => {
    setGarages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddStorage = () => {
    setStorages(prev => [...prev, { number: '', area: '' }]);
  };

  const handleRemoveStorage = (index) => {
    setStorages(prev => prev.filter((_, i) => i !== index));
  };

  const handleStorageChange = (index, field, value) => {
    setStorages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanOwners = owners
      .map(o => {
        const cleanEmail = (o.email || '').trim();
        const cleanPhone = formatPhoneNumber((o.phone || '').trim());

        return {
          name: o.name.trim(),
          share: o.share ? o.share.trim() : '',
          email: cleanEmail,
          emails: cleanEmail ? [cleanEmail] : [],
          phone: cleanPhone,
          phones: cleanPhone ? [cleanPhone] : []
        };
      })
      .filter(o => Boolean(o.name));

    if (!flatNum.trim() || cleanOwners.length === 0) return;

    const compositeOwnerName = cleanOwners
      .map(o => (cleanOwners.length > 1 && o.share) ? `${o.name} (${o.share})` : o.name)
      .join(', ');

    const primaryEmail = cleanOwners.find(o => o.email)?.email || '';
    const primaryPhone = cleanOwners.find(o => o.phone)?.phone || '';

    const cleanGarages = garages
      .map(g => ({
        number: (g.number || '').trim(),
        area: (g.area || '').toString().trim().replace(',', '.')
      }))
      .filter(g => Boolean(g.number || g.area));

    const cleanStorages = storages
      .map(s => ({
        number: (s.number || '').trim(),
        area: (s.area || '').toString().trim().replace(',', '.')
      }))
      .filter(s => Boolean(s.number || s.area));

    const formattedGarageNum = cleanGarages.map(g => formatAnnexItem(g)).join(', ');
    const formattedStorageNum = cleanStorages.map(s => formatAnnexItem(s)).join(', ');

    addFlat({
      flatNum: flatNum.trim(),
      owners: cleanOwners,
      ownerName: compositeOwnerName,
      email: primaryEmail,
      phone: primaryPhone,
      monthlyFee: Number(monthlyFee) || 0,
      renovationFee: Number(renovationFee) || 0,
      ownershipShare: parseFloat(ownershipShare) || 0,
      area: parseFloat(area) || 0,
      terraceArea: parseFloat(terrace) || 0,
      garages: cleanGarages,
      storages: cleanStorages,
      garageNum: formattedGarageNum,
      storageNum: formattedStorageNum,
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
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

          {/* Dynamic Owners Section */}
          <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span className="font-bold text-gray-900 text-xs">
                  {isEn ? "Owners" : "Tulajdonosok"} ({owners.length} {isEn ? "person" : "fő"})
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddOwner}
                className="text-[11px] text-[#1E3A8A] hover:underline font-bold flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>{isEn ? "+ Add Owner" : "+ Új tulajdonos"}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {owners.map((owner, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span>{idx + 1}. {isEn ? "Owner" : "Tulajdonos"}</span>
                    </span>
                    {owners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOwner(idx)}
                        className="text-gray-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                        title={isEn ? "Remove owner" : "Tulajdonos törlése"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className={owners.length > 1 ? '' : 'sm:col-span-2'}>
                      <label className="block text-gray-700 font-semibold mb-1 text-[10px]">
                        {t.owner_name} *
                      </label>
                      <input
                        type="text"
                        value={owner.name}
                        onChange={(e) => handleOwnerChange(idx, 'name', e.target.value)}
                        placeholder="pl. Kiss János"
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                        required
                      />
                    </div>

                    {/* Tulajdoni arány - CSAK ha 1-nél több tulajdonos van */}
                    {owners.length > 1 && (
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1 text-[10px]">
                          {isEn ? "Share (optional)" : "Tulajdoni arány (opcionális)"}
                        </label>
                        <input
                          type="text"
                          value={owner.share || ''}
                          onChange={(e) => handleOwnerChange(idx, 'share', e.target.value)}
                          placeholder="pl. 1/2 vagy 50%"
                          className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* 1 E-mail és 1 Telefonszám per tulajdonos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1 text-[10px]">
                        {t.email}
                      </label>
                      <input
                        type="email"
                        value={owner.email || ''}
                        onChange={(e) => handleOwnerChange(idx, 'email', e.target.value)}
                        placeholder="pl. kiss.janos@gmail.com"
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 font-semibold mb-1 text-[10px]">
                        {t.phone}
                      </label>
                      <input
                        type="text"
                        value={owner.phone || ''}
                        onChange={(e) => handleOwnerChange(idx, 'phone', e.target.value)}
                        onBlur={() => handleOwnerPhoneBlur(idx)}
                        placeholder="pl. +36 20 123 4567"
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ownershipShare}
                  onChange={(e) => setOwnershipShare(e.target.value)}
                  placeholder="10.5"
                  className="w-full pl-3 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">%</span>
              </div>
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

          {/* Garages dynamic rows */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">Garázs(ok)</label>
              <button
                type="button"
                onClick={handleAddGarage}
                className="text-[11px] text-[#1E3A8A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Új garázs</span>
              </button>
            </div>
            <div className="space-y-1.5">
              {garages.map((g, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={g.number}
                    onChange={(e) => handleGarageChange(idx, 'number', e.target.value)}
                    placeholder="Szám / azonosító (pl. G-01 vagy 11 sz.)"
                    className="flex-1 min-w-0 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                  <div className="relative w-24 shrink-0">
                    <input
                      type="text"
                      value={g.area}
                      onChange={(e) => handleGarageChange(idx, 'area', e.target.value)}
                      placeholder="Méret"
                      className="w-full pl-3 pr-6 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none font-medium">m²</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveGarage(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg cursor-pointer shrink-0"
                    title="Törlés"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {garages.length === 0 && (
                <div className="text-gray-400 text-xs italic">Nincs garázs hozzáadva.</div>
              )}
            </div>
          </div>

          {/* Storages dynamic rows */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">Tárolóhelyiség(ek)</label>
              <button
                type="button"
                onClick={handleAddStorage}
                className="text-[11px] text-[#1E3A8A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Új tároló</span>
              </button>
            </div>
            <div className="space-y-1.5">
              {storages.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.number}
                    onChange={(e) => handleStorageChange(idx, 'number', e.target.value)}
                    placeholder="Szám / azonosító (pl. 1 sz. vagy T-01)"
                    className="flex-1 min-w-0 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                  <div className="relative w-24 shrink-0">
                    <input
                      type="text"
                      value={s.area}
                      onChange={(e) => handleStorageChange(idx, 'area', e.target.value)}
                      placeholder="Méret"
                      className="w-full pl-3 pr-6 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none font-medium">m²</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStorage(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg cursor-pointer shrink-0"
                    title="Törlés"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {storages.length === 0 && (
                <div className="text-gray-400 text-xs italic">Nincs tároló hozzáadva.</div>
              )}
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
