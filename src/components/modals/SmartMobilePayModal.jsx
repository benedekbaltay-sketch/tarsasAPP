import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Copy, 
  Check, 
  Building2, 
  QrCode 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '../../utils/finances';
import { 
  formatHungarianIban,
  getBuildingPaymentCode,
  buildPaymentComment,
  buildPaymentRefId,
  getBankBic,
  generateMnbPaymentUrl,
  formatBankTransferPackage
} from '../../utils/qvik';

/**
 * Official MNB qvik Brand Badge Component
 * Uses the pristine 1024px high-resolution official qvik logo on pure white background
 * with crisp native typography for the "Azonnali fizetés" / "Instant Payment" lockup.
 */
function QvikBadge({ isEn = false, className = "" }) {
  return (
    <div className={`inline-flex flex-col items-center justify-center p-2 bg-white rounded-2xl select-none ${className}`}>
      <img 
        src="/qvik-logo.png" 
        alt="qvik" 
        className="h-10 sm:h-12 w-auto object-contain"
      />
      <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest text-[#25326D] uppercase mt-1">
        {isEn ? "Instant Payment" : "Azonnali fizetés"}
      </span>
    </div>
  );
}

export function SmartMobilePayModal({ 
  isOpen, 
  onClose, 
  data = null, 
  isStandalone = false 
}) {
  const { state, t, showToast } = useApp();
  const { buildings, currentBuildingId, flats, currentLang } = state;
  const isEn = currentLang === 'en';

  const [copiedIban, setCopiedIban] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen && !isStandalone) {
      const origBodyOverflow = document.body.style.overflow;
      const origDocOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = origBodyOverflow;
        document.documentElement.style.overflow = origDocOverflow;
      };
    }
  }, [isOpen, isStandalone]);

  if (!isOpen && !isStandalone) return null;

  // Resolve building, flat and financial parameters
  const currentBuilding = (buildings || []).find(b => b.id === (data?.buildingId || currentBuildingId)) || buildings?.[0] || {};
  const flatNum = data?.flatNum || state?.currentUser?.flatNum || '1';
  const fundType = data?.fundType === 'FA' ? 'FA' : 'KK';
  const targetFlat = (flats || []).find(f => f.flatNum === flatNum);

  const amount = data?.amount !== undefined && data?.amount !== null
    ? Math.max(0, Math.round(Number(data.amount) || 0))
    : (fundType === 'FA' ? Math.max(0, Math.abs(Math.round(targetFlat?.renovationBalance || 0))) : Math.max(0, Math.abs(Math.round(targetFlat?.balance || 0))));

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

  const activeBank = fundType === 'FA' ? bankFA : bankKK;
  const beneficiaryName = data?.beneficiaryName || activeBank?.name || currentBuilding?.name || "Batyu utca 21 Társasház";
  const iban = data?.iban || formatHungarianIban(activeBank?.account);

  const buildingCode = getBuildingPaymentCode(currentBuilding);
  const comment = data?.comment || buildPaymentComment({ buildingCode, flatNum, fundType });
  const refId = data?.refId || buildPaymentRefId({ flatNum, fundType });

  const bic = getBankBic(activeBank);
  const mnbUrl = generateMnbPaymentUrl({
    bic,
    beneficiaryName,
    accountHolder: beneficiaryName,
    iban,
    amount,
    comment,
    refId
  });

  const handleCopyIban = () => {
    navigator.clipboard.writeText(iban).then(() => {
      setCopiedIban(true);
      showToast(isEn ? "IBAN copied to clipboard!" : "IBAN kimásolva a vágólapra!");
      setTimeout(() => setCopiedIban(false), 2000);
    }).catch(() => {});
  };

  const handleCopyAll = () => {
    const pkg = formatBankTransferPackage({
      beneficiaryName,
      iban,
      amount,
      comment,
      isEn
    });
    navigator.clipboard.writeText(pkg).then(() => {
      setCopiedAll(true);
      showToast(t.smart_pay_all_copied || (isEn ? "All transfer details copied!" : "Minden banki adat kimásolva!"));
      setTimeout(() => setCopiedAll(false), 2000);
    }).catch(() => {});
  };

  const content = (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl overflow-hidden max-w-sm w-full mx-auto my-auto max-h-[92vh] flex flex-col transition-all animate-in fade-in zoom-in-95 duration-200">
      
      {/* Header Bar - Fixed and pinned at top, never cut off */}
      <div className={`p-4 sm:p-5 text-white relative flex-shrink-0 sticky top-0 z-10 ${fundType === 'FA' ? 'bg-gradient-to-r from-purple-800 via-indigo-900 to-purple-950' : 'bg-gradient-to-r from-[#1E3A8A] via-blue-900 to-indigo-950'}`}>
        {!isStandalone && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={t.smart_pay_close || "Bezárás"}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-sky-200/90 font-medium mb-1">
          <Building2 className="w-3.5 h-3.5 opacity-80" />
          <span className="truncate">{currentBuilding?.name || t.building_address} • {flatNum}. {isEn ? "flat" : "lakás"}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <h3 className="text-base font-bold text-white font-display">
            {fundType === 'FA' ? (t.qvik_fa_title || "Felújítási Alap (FA)") : (t.qvik_kk_title || "Közös Költség (KK)")}
          </h3>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold ${fundType === 'FA' ? 'bg-purple-400 text-purple-950' : 'bg-cyan-400 text-gray-950'}`}>
            {fundType}
          </span>
        </div>
      </div>

      {/* Main Body: Pure, minimalist qvik QR code with smooth internal scrolling if screen height is constrained */}
      <div className="p-4 sm:p-6 flex flex-col items-center text-center space-y-4 overflow-y-auto flex-1">
        
        {/* Official high-res qvik Logo */}
        <div>
          <QvikBadge isEn={isEn} />
        </div>

        {/* Outstanding Amount Due */}
        <div>
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
            {t.qvik_amount_to_pay || (isEn ? "Amount to Pay" : "Fizetendő hátralék")}
          </span>
          <div className="text-3xl font-black text-rose-600 font-display">
            {formatCurrency(amount)}
          </div>
        </div>

        {/* Clean qvik QR Code Container */}
        <div className={`p-3.5 bg-white rounded-2xl border-2 shadow-sm inline-block transition-transform hover:scale-101 ${fundType === 'FA' ? 'border-purple-300' : 'border-blue-300'}`}>
          <QRCodeSVG 
            value={mnbUrl} 
            size={210} 
            level="M" 
            includeMargin={true}
            className="rounded-xl"
          />
        </div>

        {/* Short, clear instruction for resident */}
        <p className="text-xs text-gray-600 leading-relaxed max-w-[280px]">
          {t.qvik_scan_info || (isEn 
            ? "Scan with your mobile banking app's QR reader for instant payment." 
            : "Olvassa be a banki applikációja QR-kód olvasójával az azonnali jóváhagyáshoz.")}
        </p>

        {/* Structured Bank Transfer Details with 1-click copy */}
        <div className="w-full pt-3 border-t border-gray-100 space-y-2 text-left text-xs bg-gray-50/80 p-3 rounded-2xl border border-gray-200/70 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">IBAN:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-gray-900 text-[11px]">{iban}</span>
              <button
                type="button"
                onClick={handleCopyIban}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                title={t.pay_copy}
              >
                {copiedIban ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500 font-medium">{t.pay_reference}:</span>
            <span className="font-mono font-bold text-[#1E3A8A] bg-blue-50 px-1.5 py-0.5 rounded">{comment}</span>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className="w-full mt-2 py-2.5 px-3 bg-gray-900 hover:bg-black active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? (t.smart_pay_badge_copied || "Másolva!") : (t.smart_pay_copy_all_btn || "Összes adat másolása")}</span>
          </button>
        </div>

      </div>

    </div>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] p-4 flex flex-col justify-center items-center">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="fixed inset-0 cursor-pointer" 
        onClick={onClose} 
      />
      <div className="relative z-10 w-full max-w-sm my-auto">
        {content}
      </div>
    </div>
  );
}
