import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';

/**
 * Reusable site-styled confirmation dialog rendered via React Portal.
 * Replaces native browser `window.confirm()` dialogs with a clean, accessible modal.
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  itemLabel = '',
  confirmLabel = 'Törlés',
  cancelLabel = 'Mégse',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof onCancel === 'function') onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const iconWrapClass = isDanger
    ? 'bg-rose-100 text-rose-600'
    : isWarning
      ? 'bg-amber-100 text-amber-600'
      : 'bg-blue-100 text-[#1E3A8A]';

  const confirmBtnClass = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : isWarning
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white';

  const borderAccentClass = isDanger
    ? 'border-rose-200/80'
    : isWarning
      ? 'border-amber-200/80'
      : 'border-gray-200';

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs animate-fadeIn"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && typeof onCancel === 'function') {
          onCancel();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className={`bg-white rounded-2xl border ${borderAccentClass} shadow-2xl w-full max-w-sm overflow-hidden`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconWrapClass}`}>
              {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display leading-snug">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            aria-label={cancelLabel}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-2.5">
          {message && (
            <p className="text-xs text-gray-600 leading-relaxed">
              {message}
            </p>
          )}
          {itemLabel && (
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/80 text-xs font-semibold text-gray-800 truncate">
              {itemLabel}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5 ${confirmBtnClass}`}
          >
            {isDanger && <Trash2 className="w-3.5 h-3.5" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
