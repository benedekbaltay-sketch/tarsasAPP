import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Home, Search, X, Pencil, ArrowLeft } from 'lucide-react';

export function FlatsDataModal({ isOpen, onClose, onOpenEditFlatMaster }) {
  const { state, t } = useApp();
  const { flats, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredFlats = (flats || []).filter(f => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (f.flatNum && f.flatNum.toLowerCase().includes(q)) ||
      (f.ownerName && f.ownerName.toLowerCase().includes(q)) ||
      (f.email && f.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                {isEn ? "Flats Master Data" : "Lakások adatai"}
              </h2>
              <span className="text-xs text-gray-500">
                {isEn ? "Overview of flat properties" : "Társasház lakásainak törzsadatai és paraméterei"}
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isEn ? "Search flat or owner..." : "Keresés lakás/név..."}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
          />
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlats.map((f) => (
            <div
              key={f.flatNum}
              onClick={() => onOpenEditFlatMaster(currentBuildingId, f.flatNum)}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {f.flatNum}. {isEn ? "Flat" : "lakás"}
                    </h4>
                    <span className="text-xs font-semibold text-gray-700 block">
                      {f.ownerName}
                    </span>
                  </div>
                  <button className="p-1.5 rounded-lg bg-gray-50 text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.email}:</span>
                    <span className="font-medium truncate max-w-[180px]">{f.email || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.phone}:</span>
                    <span className="font-medium">{f.phone || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.tenant_count}:</span>
                    <span className="font-medium">{f.tenantCount || 1} fő</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Terület:</span>
                    <span className="font-medium">{f.area ? `${f.area} m²` : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t.ownership_percentage}:</span>
                    <span className="font-medium">{f.ownershipShare || 0}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
                <span>Kattints a szerkesztéshez</span>
                <span className="font-semibold text-indigo-600">Részletek &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
