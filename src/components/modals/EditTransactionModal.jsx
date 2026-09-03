import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Save, Paperclip } from 'lucide-react';

export function EditTransactionModal({ itemId, itemType, isOpen, onClose }) {
  const { state, t, editItem } = useApp();
  const { transactions, expenses, manualDebits, currentLang } = state;
  const isEn = currentLang === 'en';

  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [targetAccount, setTargetAccount] = useState('Közös Költség');
  const [category, setCategory] = useState('Bank Transfer');
  const [comment, setComment] = useState('');
  const [includeInBalance, setIncludeInBalance] = useState(true);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (!isOpen || !itemId) return;

    let item = null;
    if (itemType === 'Expense') {
      item = (expenses || []).find(e => e.id === itemId);
      if (item) {
        setCategory(item.category || 'Utility');
      }
    } else if (itemType === 'Debit') {
      item = (manualDebits || []).find(d => d.id === itemId);
      if (item) {
        setCategory(item.category || 'Other');
      }
    } else {
      item = (transactions || []).find(t => t.id === itemId);
      if (item) {
        setCategory(item.method || 'Bank Transfer');
      }
    }

    if (item) {
      setDate(item.date || '');
      setAmount(Math.abs(item.amount || 0).toString());
      setTargetAccount(item.targetAccount || 'Közös Költség');
      setComment(item.comment || '');
      setIncludeInBalance(item.includeInBalance !== false);
      setAttachments(item.attachments || (item.attachment ? [item.attachment] : []));
    }
  }, [isOpen, itemId, itemType, transactions, expenses, manualDebits]);

  if (!isOpen || !itemId) return null;

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, {
          name: file.name,
          size: (file.size / 1024).toFixed(0) + " KB",
          data: reader.result
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const updatedFields = {
      date,
      amount: Number(amount),
      targetAccount,
      comment,
      includeInBalance,
      attachments
    };

    if (itemType === 'Expense') {
      updatedFields.category = category;
      updatedFields.provider = targetAccount;
    } else if (itemType === 'Debit') {
      updatedFields.category = category;
    } else {
      updatedFields.method = category;
    }

    editItem(itemId, itemType, updatedFields);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <h3 className="text-sm font-bold text-gray-900 font-display">
            {t.edit_item_title}
          </h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.date}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.amount}</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.account}</label>
            <select
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            >
              <option value="Közös Költség">{t.common_cost}</option>
              <option value="Felújítási Alap">{t.renovation_fund}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.category_method}</label>
            {itemType === 'Expense' ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              >
                <option value="Utility">{t.utility}</option>
                <option value="Insurance">{t.insurance}</option>
                <option value="Maintenance">{t.maintenance}</option>
                <option value="Bank Fee">{t.bank_fee}</option>
                <option value="Other">{isEn ? "Other" : "Egyéb"}</option>
              </select>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
              >
                <option value="Bank Transfer">{t.bank_transfer}</option>
                <option value="Cash Offset">{t.cash_offset}</option>
                <option value="Other">{isEn ? "Other" : "Egyéb"}</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t.comment}</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-700 font-medium">{t.include_in_balance_label}</span>
            <input
              type="checkbox"
              checked={includeInBalance}
              onChange={(e) => setIncludeInBalance(e.target.checked)}
              className="w-4 h-4 rounded text-[#1E3A8A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.attach_doc}</span>
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
            />
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
              <Save className="w-3.5 h-3.5" />
              <span>{t.save}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
