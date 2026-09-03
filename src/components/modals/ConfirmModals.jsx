import React from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Trash2, Check, Key, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/finances';

// 1. Delete Flat Confirmation Modal
export function DeleteFlatConfirmModal({ isOpen, flatNum, onClose, onConfirm }) {
  const { t } = useApp();
  if (!isOpen || !flatNum) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900">{t.delete_confirm_title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {t.delete_confirm_desc} ({flatNum}. lakás)
        </p>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(flatNum);
              onClose();
            }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
          >
            {t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

// 2. Delete Transaction / Expense Confirmation Modal
export function DeleteTxConfirmModal({ isOpen, itemId, itemType, onClose, onConfirm }) {
  const { t } = useApp();
  if (!isOpen || !itemId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Trash2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900">{t.delete_tx_title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {t.delete_tx_desc}
        </p>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(itemId, itemType);
              onClose();
            }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
          >
            {t.delete_btn}
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. Delete Document Confirmation Modal
export function DeleteDocConfirmModal({ isOpen, docId, onClose, onConfirm }) {
  const { t } = useApp();
  if (!isOpen || !docId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <Trash2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900">{t.delete_doc_confirm}</h3>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(docId);
              onClose();
            }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
          >
            {t.delete_btn}
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. Quick Pay Confirmation Modal
export function QuickPayConfirmModal({ isOpen, flatNum, accountType, amount, onClose, onConfirm }) {
  const { t } = useApp();
  if (!isOpen || !flatNum) return null;

  const targetAccount = accountType === 'KK' ? 'Közös Költség' : 'Felújítási Alap';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <Plus className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Befizetés gyors rögzítése</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Biztosan rögzítesz egy <strong>{formatCurrency(amount)}</strong> összegű befizetést a(z) <strong>{flatNum}. lakáshoz</strong> ({targetAccount})?
        </p>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(flatNum, targetAccount, amount);
              onClose();
            }}
            className="flex-1 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.save}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. Reset Resident Password Modal
export function ResetPassConfirmModal({ isOpen, flatNum, onClose, onConfirm }) {
  const { t } = useApp();
  if (!isOpen || !flatNum) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-[#1E3A8A] flex items-center justify-center mx-auto">
          <Key className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Biztosan visszaállítod a jelszót?</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          A(z) <strong>{flatNum}. lakás</strong> jelszava visszaáll az alapértelmezett <strong>lakas123</strong> jelszóra.
        </p>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(flatNum);
              onClose();
            }}
            className="flex-1 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Visszaállítás</span>
          </button>
        </div>
      </div>
    </div>
  );
}
