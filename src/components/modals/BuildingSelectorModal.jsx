import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, Users, Plus, Check, Building2 } from 'lucide-react';

export function BuildingSelectorModal({ isOpen, onClose, onOpenAddBuilding }) {
  const { state, t, switchBuilding, quickLogin } = useApp();
  const { buildings, currentBuildingId, users, currentUser, currentLang } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin';

  if (!isOpen) return null;

  const handleSelectBuilding = (buildingId) => {
    switchBuilding(buildingId);
    onClose();
  };

  const handleSelectUser = (user) => {
    quickLogin(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1E3A8A]" />
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {t.profile_selector_btn}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* Condominiums */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              {t.select_building}
            </span>
            <div className="space-y-1.5">
              {(buildings || []).map((b) => {
                const isActive = b.id === currentBuildingId;
                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBuilding(b.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'bg-blue-50/70 border-[#1E3A8A] text-[#1E3A8A] font-bold' 
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4" />
                      <div className="text-xs">
                        <div>{b.name}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{b.address}</div>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User profile quick switch */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              {isEn ? "Profiles" : "Profilok"}
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(users || []).map((u) => {
                const isSelected = currentUser?.id === u.id;
                return (
                  <button
                    key={u.id || u.flatNum}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 font-bold'
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xs">
                      <div className="font-semibold text-gray-900">{u.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {u.role === 'admin' ? 'Közös Képviselet' : `${u.flatNum}. lakás`}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#1E3A8A]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Add Building Action */}
          {isAdmin && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  onClose();
                  onOpenAddBuilding();
                }}
                className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.add_building_title}</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
