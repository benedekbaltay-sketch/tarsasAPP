import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Pencil, 
  Save, 
  Home, 
  Key, 
  Plus, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Square, 
  Users 
} from 'lucide-react';

export function EditFlatMasterModal({ buildingId, flatNum, isOpen, onClose }) {
  const { state, t, saveFlatMaster, resetFlatPassword } = useApp();
  const { flats, currentLang } = state;
  const isEn = currentLang === 'en';

  const [isEditMode, setIsEditMode] = useState(false);

  // Editable fields
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ownershipShare, setOwnershipShare] = useState('');
  const [area, setArea] = useState('');
  const [tenantCount, setTenantCount] = useState('1');
  const [terraceArea, setTerraceArea] = useState('');
  const [garages, setGarages] = useState([]);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');

  const flat = (flats || []).find(f => f.flatNum === flatNum);

  useEffect(() => {
    if (flat && isOpen) {
      setOwnerName(flat.ownerName || '');
      setEmail(flat.email || '');
      setPhone(flat.phone || '');
      setOwnershipShare((flat.ownershipShare !== undefined ? flat.ownershipShare : '').toString());
      setArea((flat.area !== undefined ? flat.area : '').toString());
      setTenantCount((flat.tenantCount || 1).toString());
      setTerraceArea((flat.terraceArea !== undefined ? flat.terraceArea : '').toString());
      setEmergencyContact(flat.emergencyContact || '');
      setNotes(flat.notes || '');

      const flatGarages = flat.garages 
        ? (Array.isArray(flat.garages) ? flat.garages : [flat.garages])
        : [];
      setGarages(flatGarages.map(g => typeof g === 'object' ? (g.area || '') : g.toString()));
      setIsEditMode(false);
    }
  }, [flat, isOpen]);

  if (!isOpen || !flat) return null;

  const handleAddGarage = () => {
    setGarages(prev => [...prev, '']);
  };

  const handleRemoveGarage = (index) => {
    setGarages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGarageChange = (index, val) => {
    setGarages(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    const cleanGarages = garages.map(g => g.trim()).filter(Boolean);
    saveFlatMaster(flatNum, {
      ownerName: ownerName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      ownershipShare: parseFloat(ownershipShare) || 0,
      area: parseFloat(area) || 0,
      tenantCount: parseInt(tenantCount, 10) || 1,
      terraceArea: parseFloat(terraceArea) || 0,
      garages: cleanGarages,
      emergencyContact: emergencyContact.trim(),
      notes: notes.trim()
    });
    setIsEditMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                {flat.flatNum}. {isEn ? "Flat Master Data" : "Lakás törzsadatai"}
              </h3>
              <span className="text-xs text-gray-500">
                {flat.ownerName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                title={t.edit}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!isEditMode ? (
            /* Read-only view */
            <div className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">{t.owner_name}</span>
                  <span className="font-bold text-gray-900 text-sm">{flat.ownerName}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">{t.email}</span>
                  <span className="font-bold text-gray-800 truncate block">{flat.email || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block">{t.ownership_percentage}</span>
                  <span className="font-bold text-gray-900">{flat.ownershipShare || 0}%</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block">Alapterület</span>
                  <span className="font-bold text-gray-900">{flat.area || "-"} m²</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block">Terasz</span>
                  <span className="font-bold text-gray-900">{flat.terraceArea || "-"} m²</span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block">{t.tenant_count}</span>
                  <span className="font-bold text-gray-900">{flat.tenantCount || 1} fő</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block mb-1">Garázs(ok)</span>
                <span className="font-semibold text-gray-800">
                  {garages.length > 0 ? garages.join(" m², ") + " m²" : "Nincs garázs rögzítve"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">{t.phone}</span>
                  <span className="font-semibold text-gray-800">{flat.phone || "-"}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">Vészhelyzeti elérhetőség</span>
                  <span className="font-semibold text-gray-800">{flat.emergencyContact || "-"}</span>
                </div>
              </div>

              {flat.notes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">Megjegyzések</span>
                  <p className="text-gray-700 whitespace-pre-wrap">{flat.notes}</p>
                </div>
              )}

              {/* Password reset action */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-500">Lakás belépési jelszó:</span>
                <button
                  type="button"
                  onClick={() => resetFlatPassword(flat.flatNum)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  <span>Jelszó visszaállítása</span>
                </button>
              </div>

            </div>
          ) : (
            /* Edit view */
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">{t.owner_name}</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">{t.email}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">{t.ownership_percentage}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ownershipShare}
                    onChange={(e) => setOwnershipShare(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Terület (m²)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Terasz (m²)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={terraceArea}
                    onChange={(e) => setTerraceArea(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">{t.tenant_count}</label>
                  <input
                    type="number"
                    min="1"
                    value={tenantCount}
                    onChange={(e) => setTenantCount(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              {/* Garages dynamic rows */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-gray-700">Garázsok mérete (m²)</label>
                  <button
                    type="button"
                    onClick={handleAddGarage}
                    className="text-[11px] text-[#1E3A8A] hover:underline font-bold flex items-center gap-1"
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
                        value={g}
                        onChange={(e) => handleGarageChange(idx, e.target.value)}
                        placeholder={`Garázs ${idx + 1} mérete (m²)`}
                        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveGarage(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">{t.phone}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Vészhelyzeti elérhetőség</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Egyéb megjegyzés</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1E3A8A] text-white rounded-lg text-xs font-bold hover:bg-[#1e40af] flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.save}</span>
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
