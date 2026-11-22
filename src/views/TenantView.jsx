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
  ArrowDownLeft,
  Shield,
  Phone,
  Mail,
  Maximize2,
  LineChart,
  ArrowRight,
  Filter,
  Minus,
  QrCode,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Settings,
  Key,
  Building2,
  Clock
} from 'lucide-react';
import { resolveBuildingResidentContact } from '../utils/teamPermissions';
import { QRCodeSVG } from 'qrcode.react';
import { 
  formatCurrency, 
  getCurrentFee, 
  getCombinedFlatLedgerTimeline, 
  getBalanceBadge,
  getBuildingAccounts
} from '../utils/finances';
import { exportTimelineToExcel } from '../utils/exportExcel';
import { TransactionFilterBar } from '../components/TransactionFilterBar';
import { initialFilterState, applyTransactionFilters, getActiveFilterCount } from '../utils/filterUtils';
import {
  formatHungarianIban,
  getBankBic,
  getBuildingPaymentCode,
  buildPaymentComment,
  buildPaymentRefId,
  generateMnbPaymentUrl,
  generateSmartPayUrl,
  formatBankTransferPackage
} from '../utils/qvik';
import { SmartMobilePayModal } from '../components/modals/SmartMobilePayModal';

export function TenantView({ 
  onOpenFullscreenTx, 
  onOpenFinanceModal,
  onOpenCalendar,
  onOpenChangePassword,
  onOpenSettings
}) {
  const { state, t, showToast } = useApp();
  const { currentUser, flats, buildings, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [txFilters, setTxFilters] = useState(initialFilterState);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mobilePayModalData, setMobilePayModalData] = useState(null);
  // Ideiglenesen elrejtve, amíg nincs szerződött qvik pénzforgalmi partner
  const SHOW_QVIK_PAY_BUTTON = false;

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

  const allAccounts = getBuildingAccounts(currentBuilding);
  const buildingCode = getBuildingPaymentCode(currentBuilding);

  const resolvedContact = resolveBuildingResidentContact(currentBuilding, state.repProfile, state.organizations);
  const repName = resolvedContact.name || "";
  const repPhone = resolvedContact.phone || "";
  const repEmail = resolvedContact.email || "";
  const repOfficeHours = resolvedContact.officeHours || "";
  const isPersonalManagerContact = Boolean(resolvedContact.isPersonalManager);

  const copyBankPackage = (accountKey, debtAmount, defaultAmount, iban, ben, comment) => {
    const text = formatBankTransferPackage({
      beneficiaryName: ben,
      iban,
      amount: debtAmount > 0 ? debtAmount : defaultAmount,
      comment,
      isEn
    });
    copyToClipboard(text, `pkg-${accountKey}`);
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      showToast(isEn ? "Copied to clipboard!" : "Másolva a vágólapra!");
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const allTimeline = getCombinedFlatLedgerTimeline(flat.flatNum, state);
  const postFilterTimeline = applyTransactionFilters(allTimeline, txFilters);
  const activeTxFilterCount = getActiveFilterCount(txFilters);
  
  const filteredTimeline = postFilterTimeline.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.date && item.date.toLowerCase().includes(q)) ||
      (item.account && item.account.toLowerCase().includes(q)) ||
      (item.comment && item.comment.toLowerCase().includes(q)) ||
      (item.amount !== undefined && item.amount !== null && item.amount.toString().includes(q))
    );
  });

  const displayItems = (searchQuery || activeTxFilterCount > 0) ? filteredTimeline : filteredTimeline.slice(0, 3);

  const handleExportExcel = () => {
    exportTimelineToExcel(allTimeline, flat.flatNum, isEn);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      
      {/* 1. Common Representative Quick Contact Card (Placed at the very top) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                {isPersonalManagerContact
                  ? (t.rep_manager_contact_title || (isEn ? "Responsible Property Manager" : "Felelős házkezelő elérhetősége"))
                  : (t.rep_contact_title || (isEn ? "Representative Contact" : "Közös Képviselet elérhetősége"))}
              </span>
              <h4 className="text-base font-bold text-gray-900 leading-tight">
                {repName}
              </h4>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 font-medium">
                  {currentBuilding?.name || t.building_address}
                </span>
                {repOfficeHours && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-[10px] font-semibold">
                    <Clock className="w-3 h-3" />
                    <span>{repOfficeHours}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs w-full md:w-auto">
            {/* Phone pill */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-xl px-3.5 py-2 text-gray-800">
              <Phone className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
              <a 
                href={`tel:${repPhone.replace(/\s+/g, '')}`}
                className="font-semibold hover:text-[#1E3A8A] hover:underline"
                title={isEn ? "Call representative" : "Hívás"}
              >
                {repPhone}
              </a>
              <button
                onClick={() => copyToClipboard(repPhone, 'repPhone')}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors ml-1 cursor-pointer"
                title={t.pay_copy}
              >
                {copiedKey === 'repPhone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Email pill */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-xl px-3.5 py-2 text-gray-800">
              <Mail className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
              <a 
                href={`mailto:${repEmail}`}
                className="font-semibold hover:text-[#1E3A8A] hover:underline truncate max-w-[200px]"
                title={isEn ? "Send email" : "E-mail küldése"}
              >
                {repEmail}
              </a>
              <button
                onClick={() => copyToClipboard(repEmail, 'repEmail')}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors ml-1 cursor-pointer"
                title={t.pay_copy}
              >
                {copiedKey === 'repEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick Settings & Change Password buttons */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 hover:bg-gray-100 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-800 transition-colors cursor-pointer"
                title={t.menu_account_settings || (isEn ? "Settings" : "Beállítások")}
              >
                <Settings className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>{t.nav_settings || (isEn ? "Settings" : "Beállítások")}</span>
              </button>
            )}

            {onOpenChangePassword && (
              <button
                type="button"
                onClick={onOpenChangePassword}
                className="flex items-center gap-1.5 bg-blue-50 border border-blue-200/80 hover:bg-blue-100 rounded-xl px-3.5 py-2 text-xs font-bold text-[#1E3A8A] transition-colors cursor-pointer"
                title={t.change_password || (isEn ? "Change Password" : "Jelszó módosítása")}
              >
                <Key className="w-3.5 h-3.5" />
                <span>{t.change_password || (isEn ? "Change Password" : "Jelszó módosítása")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Secondary Escalation Bar: Displayed when enabled by Owner */}
        {resolvedContact?.showCentralEscalation && resolvedContact?.centralCompany && (resolvedContact.centralCompany.phone || resolvedContact.centralCompany.email) && (
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
              <span className="font-semibold text-gray-700">
                {t.tenant_central_escalation_title || (isEn ? "Central Management Office / Escalation:" : "Központi Iroda / Ügyfélszolgálat (Eszkaláció):")}
              </span>
              <span className="font-bold text-gray-900">{resolvedContact.centralCompany.name}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {resolvedContact.centralCompany.phone && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Phone className="w-3 h-3 text-[#1E3A8A]" />
                  <a
                    href={`tel:${resolvedContact.centralCompany.phone.replace(/\s+/g, '')}`}
                    className="font-semibold hover:text-[#1E3A8A] hover:underline"
                    title={isEn ? "Call Central Office" : "Központi szám hívása"}
                  >
                    {resolvedContact.centralCompany.phone}
                  </a>
                </div>
              )}
              {resolvedContact.centralCompany.email && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Mail className="w-3 h-3 text-[#1E3A8A]" />
                  <a
                    href={`mailto:${resolvedContact.centralCompany.email}`}
                    className="font-semibold hover:text-[#1E3A8A] hover:underline truncate max-w-[220px]"
                    title={isEn ? "Email Central Office" : "Központi e-mail küldése"}
                  >
                    {resolvedContact.centralCompany.email}
                  </a>
                </div>
              )}
              {resolvedContact.centralCompany.officeHours && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>{resolvedContact.centralCompany.officeHours}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Flat Financial Status & Bank Transfer Sections (Dynamic per account) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {allAccounts.map(acc => {
          let balance = 0;
          if (acc.id === 'KK') {
            balance = flat.balance || 0;
          } else if (acc.id === 'FA') {
            balance = flat.renovationBalance || 0;
          } else {
            balance = (flat.customBalances && flat.customBalances[acc.id] !== undefined)
              ? flat.customBalances[acc.id]
              : ((flat.customBalances && flat.customBalances[acc.name] !== undefined) ? flat.customBalances[acc.name] : 0);
          }

          let curFee = 0;
          if (acc.hasMonthlyFee) {
            curFee = getCurrentFee(flat, acc.id) || (acc.id === 'KK' ? Number(flat.monthlyFee) : (acc.id === 'FA' ? Number(flat.renovationFee) : Number(flat.customFees?.[acc.id] || flat.customFees?.[acc.name]))) || 0;
          }

          const badge = getBalanceBadge(balance, isEn);
          const debt = balance < 0 ? Math.abs(Math.round(balance)) : 0;
          const beneficiary = acc.beneficiary || currentBuilding?.name || (isEn ? "Condominium" : "Társasház");
          const iban = formatHungarianIban(acc.account);
          const comment = buildPaymentComment({ buildingCode, flatNum: flat.flatNum, fundType: acc.shortName || acc.id });

          const isFA = acc.id === 'FA';
          const isKK = acc.id === 'KK';
          const pillBg = isKK ? 'bg-[#1E3A8A] text-white' : (isFA ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white');
          const debtBoxStyle = isKK 
            ? 'bg-blue-50/70 border-blue-200/90 text-blue-900' 
            : (isFA ? 'bg-purple-50/70 border-purple-200/90 text-purple-900' : 'bg-emerald-50/70 border-emerald-200/90 text-emerald-900');
          const linkColor = isKK ? 'text-[#1E3A8A]' : (isFA ? 'text-purple-700' : 'text-emerald-700');
          const codeStyle = isKK ? 'text-[#1E3A8A] border-blue-200' : (isFA ? 'text-purple-800 border-purple-200' : 'text-emerald-800 border-emerald-200');

          return (
            <div key={acc.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
              <div className="space-y-4">
                
                {/* Header: Cím + Havi előírás */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs ${pillBg}`}>
                      {acc.shortName}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 font-display">
                        {acc.name}
                      </h3>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {currentBuilding?.name || t.building_address}
                      </span>
                    </div>
                  </div>
                  {acc.hasMonthlyFee && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                        {t.monthly_short}
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {formatCurrency(curFee)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Aktuális egyenleg kijelzés */}
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 font-medium block mb-0.5">
                      {isKK 
                        ? (t.current_kk_balance || (isEn ? "Current KK Balance" : "Aktuális KK egyenleg")) 
                        : (isFA 
                            ? (t.current_fa_balance || (isEn ? "Current FA Balance" : "Aktuális FA egyenleg")) 
                            : `${acc.name} ${isEn ? "Balance" : "egyenleg"}`)}
                    </span>
                    <div className={`text-2xl font-black font-display ${balance < 0 ? 'text-rose-600' : balance > 0 ? (isKK ? 'text-emerald-700' : isFA ? 'text-purple-700' : 'text-emerald-700') : 'text-gray-900'}`}>
                      {formatCurrency(balance)}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bgClass}`}>
                    {badge.text}
                  </span>
                </div>

                {/* Dynamic Payment vs. Settled / Overpaid Area */}
                {debt > 0 ? (
                  <div className={`border rounded-xl p-3.5 space-y-2 text-xs shadow-2xs ${debtBoxStyle}`}>
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span>{t.pay_transfer_details_debt || (isEn ? "Transfer details to settle arrears:" : "Átutalási adatok a hátralék rendezéséhez:")}</span>
                      <button
                        type="button"
                        onClick={() => copyBankPackage(acc.id, debt, curFee, iban, beneficiary, comment)}
                        className={`hover:underline font-bold inline-flex items-center gap-1 cursor-pointer ${linkColor}`}
                      >
                        {copiedKey === `pkg-${acc.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === `pkg-${acc.id}` ? (t.qvik_all_details_copied || "Másolva!") : (t.pay_copy || "Adatok másolása")}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t.pay_beneficiary}:</span>
                      <strong className="text-gray-900 truncate max-w-[200px] sm:max-w-none">{beneficiary}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t.qvik_iban_label || "Bankszámla (IBAN)"}:</span>
                      <span className="font-mono font-bold text-gray-900">{iban || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t.qvik_ref_label || t.pay_reference}:</span>
                      <code className={`font-bold bg-white border px-1.5 py-0.5 rounded font-mono text-[11px] ${codeStyle}`}>{comment}</code>
                    </div>
                  </div>
                ) : (
                  /* Nullás vagy túlfizetéses visszajelzés */
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950">
                          {balance > 0 
                            ? (t.qvik_overpaid_no_debt ? t.qvik_overpaid_no_debt.replace('{amount}', formatCurrency(balance)) : `Túlfizetés: ${formatCurrency(balance)} (Nincs fizetési kötelezettség)`)
                            : (t.qvik_no_arrears || "Nincs hátralék")}
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {balance > 0 
                            ? (isEn ? `You currently have no payment obligation for ${acc.name}.` : `A(z) ${acc.name} egyenlege pozitív, nincs fizetési kötelezettség.`)
                            : (t.qvik_no_arrears_desc || (isEn ? "All due charges are fully settled." : "Minden előírás és korábbi terhelés rendezve van."))
                          }
                        </p>
                      </div>
                    </div>

                    {/* Előrehozott utaláshoz banki adatok */}
                    <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mb-1">
                        <span>{t.qvik_advance_pay_hint || (isEn ? "For regular transfers:" : "Előrehozott utaláshoz banki adatok:")}</span>
                        <button
                          type="button"
                          onClick={() => copyBankPackage(acc.id, debt, curFee, iban, beneficiary, comment)}
                          className={`hover:underline font-bold inline-flex items-center gap-1 cursor-pointer ${linkColor}`}
                        >
                          {copiedKey === `pkg-${acc.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{t.pay_copy}</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t.pay_beneficiary}:</span>
                        <strong className="text-gray-900 truncate max-w-[200px]">{beneficiary}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t.qvik_iban_label || "IBAN"}:</span>
                        <span className="font-mono font-bold text-gray-900">{iban || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t.qvik_ref_label || t.pay_reference}:</span>
                        <code className={`font-bold bg-white border px-1.5 py-0.5 rounded font-mono text-[11px] ${codeStyle}`}>{comment}</code>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Building Financial Overview & Public Debt Map Quick Access Banner */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-sky-50/70 to-blue-50/90 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
            <LineChart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
              {isEn ? "Condominium Overview" : "Társasházi Pénzügyek"}
            </span>
            <h4 className="text-base font-bold text-gray-900 leading-tight">
              {t.menu_finance || (isEn ? "Building Finances & Public Debt Map" : "A ház pénzügyi helyzete & Nyilvános tartozástérkép")}
            </h4>
            <span className="text-xs text-gray-600 font-medium block mt-0.5">
              {isEn 
                ? "Building reserves, monthly performance balance, and verified flat arrears map." 
                : "Ház tartalékai, havi bevételek/kiadások mérlege és a lakások lezárt tartozástérképe."}
            </span>
          </div>
        </div>

        {onOpenFinanceModal && (
          <button
            onClick={onOpenFinanceModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex-shrink-0 w-full sm:w-auto justify-center"
          >
            <span>{isEn ? "View Finances" : "Megtekintés"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
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
            {/* Filter Toggle Button */}
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                isFilterOpen || activeTxFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1E3A8A] shadow-xs'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={isEn ? "Filter by date, account (KK/FA), and amount" : "Szűrés dátum, KK/FA számla és összeg szerint"}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{isEn ? "Filter" : "Szűrés"}</span>
              {activeTxFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold flex items-center justify-center -mr-0.5">
                  {activeTxFilterCount}
                </span>
              )}
            </button>

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

        {/* Expandable Filter Panel */}
        <TransactionFilterBar
          filters={txFilters}
          onFilterChange={setTxFilters}
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          isEn={isEn}
          mode="flat"
          totalCount={allTimeline.length}
          resultCount={filteredTimeline.length}
        />

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
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">
                    {isEn ? "No records found" : "Nincs megjeleníthető tétel"}
                  </td>
                </tr>
              ) : (
                displayItems.map((item) => {
                  const isDebit = item.type === "Debit";
                  const isZero = Math.abs(Math.round(Number(item.amount) || 0)) === 0;
                  const isNegative = !isZero && (isDebit || (item.amount < 0));
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
                        <span className={`inline-flex items-center gap-1 ${isZero ? "text-gray-600 font-semibold" : (isNegative ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold")}`}>
                          {isZero ? <Minus className="w-3 h-3 text-gray-400" /> : (isNegative ? <ArrowDownLeft className="w-3 h-3 text-red-500" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />)}
                          {isDebit ? (isEn ? "Debit" : "Előírás") : (isEn ? "Payment" : "Befizetés")}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold whitespace-nowrap ${isZero ? "text-gray-700" : (isNegative ? "text-red-600" : "text-emerald-600")}`}>
                        {isZero ? '' : (isNegative ? '-' : '+')}{Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft
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
        {filteredTimeline.length > 3 && (
          <div className="p-3 sm:p-4 border-t border-gray-100 flex items-center justify-center bg-gray-50/50">
            <button
              onClick={() => onOpenFullscreenTx('flat')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{t.all_items}</span>
            </button>
          </div>
        )}

      </div>

      {/* Resident's Own Loan Participation Summary (GDPR-isolated slice — never exposes other units' loans) */}
      {Array.isArray(flat?.activeLoanShares) && flat.activeLoanShares.length > 0 && (
        <div className="bg-white rounded-2xl border border-purple-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-700" />
              <h3 className="text-sm font-bold text-gray-900 font-display">
                {t.tenant_own_loans_title || (isEn ? "My Apartment Loan Participation" : "Saját albetét hitelrészvétele")}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold">
              {flat.flatNum}. {isEn ? "Flat" : "lakás"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {flat.activeLoanShares.map((share) => (
              <div key={share.loanId} className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 truncate">{share.loanTitle}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    share.status === 'paid_off'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {share.paymentMethod === 'lump_sum'
                      ? (isEn ? "Paid Lump Sum" : "Egyösszegben rendezve")
                      : (isEn ? "Monthly Financed" : "Havi törlesztéses")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span>{isEn ? "Apartment share:" : "Albetétre jutó összeg:"}</span>
                  <strong className="text-gray-900">{Math.round(share.totalShareHuf || 0).toLocaleString('hu-HU')} Ft</strong>
                </div>
                {share.paymentMethod === 'financed' && share.monthlyContributionHuf > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-purple-800">
                    <span>{isEn ? "Monthly installment:" : "Havi törlesztőrészlet:"}</span>
                    <strong>{Math.round(share.monthlyContributionHuf).toLocaleString('hu-HU')} Ft / {isEn ? "mo" : "hó"}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intelligent Mobile Payment Modal */}
      <SmartMobilePayModal
        isOpen={Boolean(mobilePayModalData)}
        onClose={() => setMobilePayModalData(null)}
        data={mobilePayModalData}
      />

    </div>
  );
}
