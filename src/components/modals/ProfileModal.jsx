import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  User, 
  ArrowLeft, 
  Key, 
  Phone, 
  Mail, 
  Home, 
  Users, 
  Save, 
  PhoneCall, 
  ShieldCheck 
} from 'lucide-react';

export function ProfileModal({
  isOpen,
  onClose,
  onOpenChangePassword,
  onOpenProfileSelector
}) {
  const { state, t, saveFlatMaster, showToast } = useApp();
  const { currentUser, flats, buildings, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const flat = (flats || []).find(f => f.flatNum === currentUser?.flatNum);

  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (flat && isOpen) {
      setPhone(flat.phone || '');
      setEmergencyContact(flat.emergencyContact || '');
      setNotes(flat.notes || '');
    }
  }, [flat, isOpen]);

  if (!isOpen || !currentUser) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];

  const handleSaveContact = (e) => {
    e.preventDefault();
    if (!flat) return;
    saveFlatMaster(flat.flatNum, {
      phone: phone.trim(),
      emergencyContact: emergencyContact.trim(),
      notes: notes.trim()
    });
    showToast(isEn ? "Contact info updated!" : "Elérhetőségek sikeresen frissítve!");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                {t.menu_profile}
              </h2>
              <span className="text-xs text-gray-500">
                {currentUser.name}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Profile Selector button */}
        <button
          onClick={onOpenProfileSelector}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-xs"
        >
          <Users className="w-3.5 h-3.5 text-[#1E3A8A]" />
          <span>{t.profile_selector_btn}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
        
        {/* User Account Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center text-xl font-black">
              {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{currentUser.name}</h3>
              <p className="text-xs text-gray-500">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-[#1E3A8A]">
                  {currentUser.role === 'admin' ? 'Közös Képviselő' : `${currentUser.flatNum}. lakás`}
                </span>
                <span className="text-xs text-gray-400">&bull; {currentBuilding?.name}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenChangePassword}
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>{t.change_password}</span>
          </button>
        </div>

        {/* Flat Details (if Owner) */}
        {flat && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Home className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-bold text-gray-900">Lakás alapadatok</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">Lakásszám</span>
                <span className="font-bold text-gray-900 text-sm">{flat.flatNum}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">Alapterület</span>
                <span className="font-bold text-gray-900 text-sm">{flat.area || "-"} m²</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">Tulajdoni hányad</span>
                <span className="font-bold text-gray-900 text-sm">{flat.ownershipShare || 0}%</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block mb-0.5">Bejelentett lakók</span>
                <span className="font-bold text-gray-900 text-sm">{flat.tenantCount || 1} fő</span>
              </div>
            </div>

            {/* Editable contact form */}
            <form onSubmit={handleSaveContact} className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-gray-700">Elérhetőségek frissítése</h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t.phone}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+36 30 123 4567"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Másodlagos / Vészhelyzeti elérhetőség</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Név, telefonszám"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Megjegyzés / Bérlői adatok</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Közlendő vagy egyéb adatok"
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.save}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Common Representative Quick Contact */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-gray-900">Közös Képviselet elérhetősége</h4>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <div className="font-bold text-gray-900 text-sm">Baltay Benedek</div>
              <div className="text-gray-500 mt-0.5">+36 20 397 1253 &bull; benedek.baltay@gmail.com</div>
            </div>
            <a
              href="tel:+36203971253"
              className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-[#1E3A8A] font-bold text-xs flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Hívás</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
