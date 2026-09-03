import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, PlusCircle, MinusCircle, Upload, Paperclip, Save } from 'lucide-react';

export function TransactionModal({ isOpen, onClose }) {
  const { state, t, addTransaction, addExpense } = useApp();
  const { flats, currentLang } = state;
  const isEn = currentLang === 'en';

  const [activeTab, setActiveTab] = useState('payment'); // 'payment' | 'expense'

  // Payment fields
  const [payFlat, setPayFlat] = useState((flats && flats[0]?.flatNum) || 'Fsz 2');
  const [payAccount, setPayAccount] = useState('Közös Költség');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [payComment, setPayComment] = useState('');
  const [payIncludeBalance, setPayIncludeBalance] = useState(true);
  const [payAttachments, setPayAttachments] = useState([]);

  // Expense fields
  const [expCategory, setExpCategory] = useState('Utility');
  const [expAccount, setExpAccount] = useState('Közös Költség');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expAmount, setExpAmount] = useState('');
  const [expComment, setExpComment] = useState('');
  const [expIncludeBalance, setExpIncludeBalance] = useState(true);
  const [expAttachments, setExpAttachments] = useState([]);

  if (!isOpen) return null;

  const handleFileUpload = (e, setAttachments) => {
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

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) return;

    addTransaction({
      id: `t-${Date.now()}`,
      date: payDate,
      flatNum: payFlat,
      targetAccount: payAccount,
      amount: Number(payAmount),
      status: "Verified",
      method: "Bank Transfer",
      comment: payComment,
      includeInBalance: payIncludeBalance,
      attachments: payAttachments
    });

    onClose();
  };

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return;

    addExpense({
      id: `e-${Date.now()}`,
      date: expDate,
      provider: expAccount,
      targetAccount: expAccount,
      amount: Number(expAmount),
      category: expCategory,
      comment: expComment,
      includeInBalance: expIncludeBalance,
      attachments: expAttachments
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <h3 className="text-base font-bold text-gray-900 font-display">
            {t.transaction_modal_title}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Segmented Switcher */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              {t.type}
            </label>
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('payment')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'payment'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isEn ? "Payment (+)" : "Befizetés (+)"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('expense')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'expense'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>{isEn ? "Expense (-)" : "Kiadás (-)"}</span>
              </button>
            </div>
          </div>

          {/* Form: Payment */}
          {activeTab === 'payment' && (
            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.flat}</label>
                <select
                  value={payFlat}
                  onChange={(e) => setPayFlat(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  {(flats || []).map(f => (
                    <option key={f.flatNum} value={f.flatNum}>
                      {f.flatNum} - {f.ownerName}
                    </option>
                  ))}
                  <option value="Global">Egyéb / Global</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.account}</label>
                <select
                  value={payAccount}
                  onChange={(e) => setPayAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="Közös Költség">{t.common_cost}</option>
                  <option value="Felújítási Alap">{t.renovation_fund}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.date}</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.amount}</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="pl. 25000"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.comment}</label>
                <input
                  type="text"
                  value={payComment}
                  onChange={(e) => setPayComment(e.target.value)}
                  placeholder="pl. Augusztusi befizetés"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-700 font-medium">{t.include_in_balance_label}</span>
                <input
                  type="checkbox"
                  checked={payIncludeBalance}
                  onChange={(e) => setPayIncludeBalance(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.attach_doc}</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e, setPayAttachments)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {payAttachments.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {payAttachments.map((att, idx) => (
                      <div key={idx} className="text-[11px] text-gray-600 truncate bg-gray-50 p-1 rounded">
                        &bull; {att.name} ({att.size})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.save_payment}</span>
                </button>
              </div>
            </form>
          )}

          {/* Form: Expense */}
          {activeTab === 'expense' && (
            <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.category}</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="Utility">{t.utility}</option>
                  <option value="Insurance">{t.insurance}</option>
                  <option value="Maintenance">{t.maintenance}</option>
                  <option value="Bank Fee">{t.bank_fee}</option>
                  <option value="Other">{isEn ? "Other" : "Egyéb"}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.account}</label>
                <select
                  value={expAccount}
                  onChange={(e) => setExpAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                >
                  <option value="Közös Költség">{t.common_cost}</option>
                  <option value="Felújítási Alap">{t.renovation_fund}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.date}</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.amount}</label>
                <input
                  type="number"
                  min="1"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="pl. 15000"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t.comment}</label>
                <input
                  type="text"
                  value={expComment}
                  onChange={(e) => setExpComment(e.target.value)}
                  placeholder="pl. Villanyóra leolvasás / ELMŰ"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-700 font-medium">{t.include_in_balance_label}</span>
                <input
                  type="checkbox"
                  checked={expIncludeBalance}
                  onChange={(e) => setExpIncludeBalance(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t.attach_doc}</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e, setExpAttachments)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {expAttachments.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {expAttachments.map((att, idx) => (
                      <div key={idx} className="text-[11px] text-gray-600 truncate bg-gray-50 p-1 rounded">
                        &bull; {att.name} ({att.size})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.save_expense}</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
