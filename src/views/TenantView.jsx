import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wallet, 
  CreditCard, 
  Copy, 
  Check, 
  List, 
  Search, 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft 
} from 'lucide-react';
import { 
  formatCurrency, 
  getCurrentFee, 
  getCombinedFlatLedgerTimeline, 
  getBalanceBadge 
} from '../utils/finances';
import { exportTimelineToExcel } from '../utils/exportExcel';

export function TenantView({ onOpenFullscreenTx }) {
  const { state, t, showToast } = useApp();
  const { currentUser, flats, buildings, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  if (!currentUser) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const flat = (flats || []).find(f => f.flatNum === currentUser.flatNum) || {
    flatNum: currentUser.flatNum || "Fsz 2",
    ownerName: currentUser.name || "Tulajdonos",
    monthlyFee: 0,
    renovationFee: 0,
    balance: 0,
    renovationBalance: 0
  };

  const curFeeKK = getCurrentFee(flat, 'KK');
  const curFeeFA = getCurrentFee(flat, 'FA');
  const badgeKK = getBalanceBadge(flat.balance || 0, isEn);
  const badgeFA = getBalanceBadge(flat.renovationBalance || 0, isEn);

  const bankKK = currentBuilding?.bankKK || {
    name: "Batyu utca 21 Társasház",
    account: "11702005 21461266",
    bank: "OTP"
  };
  const bankFA = currentBuilding?.bankFA || {
    name: "Batyu utca 21 Társasház",
    account: "11702005 21461273",
    bank: "OTP"
  };

  const paymentRefKK = `Batyu 21. ${flat.flatNum} KK`;
  const paymentRefFA = `Batyu 21. ${flat.flatNum} FA`;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      showToast(isEn ? "Copied to clipboard!" : "Másolva a vágólapra!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const allTimeline = getCombinedFlatLedgerTimeline(flat.flatNum, state);
  
  const filteredTimeline = allTimeline.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.date && item.date.toLowerCase().includes(q)) ||
      (item.account && item.account.toLowerCase().includes(q)) ||
      (item.comment && item.comment.toLowerCase().includes(q)) ||
      (item.amount && item.amount.toString().includes(q))
    );
  });

  const previewItems = filteredTimeline.slice(0, 5);

  const handleExportExcel = () => {
    exportTimelineToExcel(allTimeline, flat.flatNum, isEn);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      
      {/* Top Grid: Balances + Bank Transfer details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: A lakás pénzügyi adatai */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-gray-900 font-display">
                {t.flat_financial_data}
              </h3>
            </div>

            <div className="space-y-3.5">
              {/* KK Box */}
              <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#1E3A8A] text-white">
                      KK
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {t.monthly_short}: <strong className="text-gray-800">{formatCurrency(curFeeKK)}</strong>
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 font-display">
                    {formatCurrency(flat.balance || 0)}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeKK.bgClass}`}>
                  {badgeKK.text}
                </span>
              </div>

              {/* FA Box */}
              <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600 text-white">
                      FA
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {t.monthly_short}: <strong className="text-gray-800">{formatCurrency(curFeeFA)}</strong>
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 font-display">
                    {formatCurrency(flat.renovationBalance || 0)}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeFA.bgClass}`}>
                  {badgeFA.text}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Utalási adatok */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900 font-display">
              {t.transfer_details_title}
            </h3>
          </div>

          <div className="space-y-4">
            
            {/* KK Bank Box */}
            <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A8A] mb-1">
                <span className="px-1.5 py-0.5 rounded bg-[#1E3A8A] text-white text-[10px]">KK</span>
                <span>{t.transfer_kk_title}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t.pay_bank_account}:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{bankKK.account} ({bankKK.bank})</span>
                  <button 
                    onClick={() => copyToClipboard(bankKK.account, 'bankKK')}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                    title={t.pay_copy}
                  >
                    {copiedKey === 'bankKK' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t.pay_reference}:</span>
                <div className="flex items-center gap-2">
                  <code className="font-bold text-[#1E3A8A] bg-blue-50 px-1.5 py-0.5 rounded">{paymentRefKK}</code>
                  <button 
                    onClick={() => copyToClipboard(paymentRefKK, 'refKK')}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                    title={t.pay_copy}
                  >
                    {copiedKey === 'refKK' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* FA Bank Box */}
            <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-700 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px]">FA</span>
                <span>{t.transfer_fa_title}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t.pay_bank_account}:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{bankFA.account} ({bankFA.bank})</span>
                  <button 
                    onClick={() => copyToClipboard(bankFA.account, 'bankFA')}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                    title={t.pay_copy}
                  >
                    {copiedKey === 'bankFA' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t.pay_reference}:</span>
                <div className="flex items-center gap-2">
                  <code className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{paymentRefFA}</code>
                  <button 
                    onClick={() => copyToClipboard(paymentRefFA, 'refFA')}
                    className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                    title={t.pay_copy}
                  >
                    {copiedKey === 'refFA' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Combined Transactions Preview Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Table Header Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-bold text-gray-900 font-display">
              {t.transactions}
            </h3>
          </div>

          <div className="flex items-center gap-3 flex-1 sm:flex-initial max-w-sm ml-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search_fullscreen_placeholder}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0 cursor-pointer"
              title="Excel export"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Table responsive */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">{t.th_date}</th>
                <th className="py-3 px-4">{t.th_account}</th>
                <th className="py-3 px-4">{t.th_type}</th>
                <th className="py-3 px-4">{t.th_amount}</th>
                <th className="py-3 px-4">{t.th_comment}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">
                    {isEn ? "No records found" : "Nincs megjeleníthető tétel"}
                  </td>
                </tr>
              ) : (
                previewItems.map((item) => {
                  const isDebit = item.type === "Debit";
                  const isKK = item.account === "Közös Költség" || item.targetAccount === "Közös Költség";
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-gray-600 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isKK ? "bg-blue-100 text-[#1E3A8A]" : "bg-purple-100 text-purple-700"}`}>
                          {isKK ? "KK" : "FA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium">
                        <span className={`inline-flex items-center gap-1 ${isDebit ? "text-gray-700" : "text-emerald-600 font-semibold"}`}>
                          {isDebit ? <ArrowDownLeft className="w-3 h-3 text-gray-400" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                          {isDebit ? (isEn ? "Debit" : "Előírás") : (isEn ? "Payment" : "Befizetés")}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold whitespace-nowrap ${isDebit ? "text-gray-900" : "text-emerald-600"}`}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                        {item.comment}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* View full list footer button */}
        <div className="p-4 border-t border-gray-100 text-center bg-gray-50/50">
          <button
            onClick={() => onOpenFullscreenTx('flat')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <List className="w-3.5 h-3.5" />
            <span>{isEn ? "View Complete History" : "Teljes lista megtekintése"}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
