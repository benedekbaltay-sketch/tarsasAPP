import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Trash2, Check, Key, Plus } from 'lucide-react';
import { formatCurrency, getBuildingAccounts } from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';

// 1. Delete Flat Confirmation Modal
export function DeleteFlatConfirmModal({ isOpen, flatNum, onClose, onConfirm }) {
  const { state, t } = useApp();
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !flatNum || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
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
  const { state, t } = useApp();
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  const backdropProps = useBackdropClose(onClose);

  useEffect(() => {
    if (!isOpen || !itemId || !isAdmin) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(itemId, itemType);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, itemId, itemType, isAdmin, onClose, onConfirm]);

  if (!isOpen || !itemId || !isAdmin) return null;

  return (
    <div {...backdropProps} className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
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
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(itemId, itemType);
              onClose();
            }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
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
  const { state, t } = useApp();
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !docId || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
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

// 3b. Delete Folder Confirmation Modal
export function DeleteFolderConfirmModal({ isOpen, folder, onClose, onConfirm }) {
  const { state, t } = useApp();
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  const isEn = state.currentLang === 'en';
  if (!isOpen || !folder || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <Trash2 className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">
            {t.delete_folder_confirm || (isEn ? "Delete Folder?" : "Biztosan törlöd a mappát?")}
          </h3>
          <p className="text-xs text-gray-700 mt-1.5 font-bold">
            "{folder.name}"
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            {t.delete_folder_desc || (isEn ? "The documents inside will remain safe and move to the root folder." : "A mappában lévő dokumentumok biztonságban megmaradnak, és automatikusan a főkönyvtárba kerülnek.")}
          </p>
        </div>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {t.cancel || "Mégse"}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(folder.id);
              onClose();
            }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            {t.delete_btn || "Törlés"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. Quick Pay Confirmation Modal
export function QuickPayConfirmModal({ isOpen, flatNum, accountType, amount, onClose, onConfirm, onOpenDetailed }) {
  const { state, t } = useApp();
  const isEn = state.currentLang === 'en';
  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !flatNum || !isAdmin) return null;

  const targetAccount = accountType === 'KK' ? 'Közös Költség' : (accountType === 'FA' ? 'Felújítási Alap' : accountType);
  const isKK = accountType === 'KK' || targetAccount === 'Közös Költség';
  const isFA = accountType === 'FA' || targetAccount === 'Felújítási Alap';

  const currentBuilding = (state.buildings || []).find(b => b.id === state.currentBuildingId) || state.buildings?.[0];
  const allAccounts = getBuildingAccounts(currentBuilding);
  const matchedAcc = allAccounts.find(a => a.id === accountType || a.name === targetAccount);
  const shortName = matchedAcc?.shortName || (accountType === 'KK' ? 'KK' : (accountType === 'FA' ? 'FA' : ''));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
          isKK ? 'bg-blue-100 text-[#1E3A8A]' : (isFA ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-800')
        }`}>
          <Plus className="w-7 h-7" />
        </div>
        
        <div>
          <h3 className="text-base font-bold text-gray-900 font-display">
            {isEn ? "1-Month Fee Quick Payment" : "1 Havi Befizetés Gyors Rögzítése"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            <strong>{flatNum}. lakás</strong> • {targetAccount} {shortName ? `(${shortName})` : ''}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-center">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            {isEn ? "1-month prescribed fee" : "1 havi előírt összeg"}
          </span>
          <span className="text-2xl font-black text-gray-900 font-display block mt-0.5">
            {formatCurrency(amount)}
          </span>
          <span className="text-[10px] text-gray-400 block mt-1">
            {isEn ? "(strictly 1 month, independent of current debt)" : "(szigorúan 1 havi összeg, független a meglévő tartozástól)"}
          </span>
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer transition-all"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(flatNum, targetAccount, amount);
              onClose();
            }}
            className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 ${
              isKK ? 'bg-[#1E3A8A] hover:bg-[#1e40af]' : (isFA ? 'bg-purple-700 hover:bg-purple-800' : 'bg-emerald-700 hover:bg-emerald-800')
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isEn ? "Record (+)" : "Befizetés (+)"}</span>
          </button>
        </div>

        {onOpenDetailed && (
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDetailed(flatNum, accountType, amount);
              }}
              className="text-[11px] text-[#1E3A8A] hover:underline font-semibold cursor-pointer"
            >
              {isEn ? "Open full entry form with details..." : "Részletes űrlap megnyitása..."}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
