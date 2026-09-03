import React from 'react';
import { useApp } from '../../context/AppContext';
import { Landmark, ArrowLeft, Sparkles } from 'lucide-react';

export function LoansModal({ isOpen, onClose }) {
  const { t } = useApp();

  if (!isOpen) return null;

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
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                {t.loans_title}
              </h2>
              <span className="text-xs text-gray-500">
                {t.loans_subtitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content: Under Development Box */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Landmark className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-gray-900 mb-3 font-display">
            {t.loans_dev_title}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {t.loans_dev_desc}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs border border-purple-100">
            <Sparkles className="w-4 h-4" />
            <span>Hamarosan elérhető</span>
          </div>
        </div>
      </div>
    </div>
  );
}
