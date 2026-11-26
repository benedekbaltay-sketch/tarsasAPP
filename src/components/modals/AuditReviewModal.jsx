import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ClipboardCheck,
  FileCheck2,
  MessageSquareWarning,
  Menu,
  X,
  Plus,
  UploadCloud,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Send,
  Eye,
  EyeOff,
  FileText,
  Receipt,
  Check,
  RotateCcw,
  Loader2,
  Shield,
  Scale,
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import {
  validateUploadFile,
  readFileAsDataUrl,
  triggerSafeDownload,
  getFileValidationErrorMessage,
  ALLOWED_ACCEPT_ATTR,
} from '../../utils/fileSecurity';
import { isUserBuildingEconomicAuditor } from '../../utils/economicAuditor';
import { isUserBuildingSzvb } from '../../utils/szvb';
import { normalizeEmail } from '../../utils/teamPermissions';

export function AuditReviewModal({
  isOpen,
  onClose,
  onOpenDrawer,
  onOpenProfileSelector,
}) {
  const {
    state,
    t,
    showToast,
    canUserManageBuilding,
    addAuditOpinion,
    fetchAuditOpinionFile,
    deleteAuditOpinion,
    toggleAuditOpinionPublish,
    addAuditObservation,
    addAuditObservationComment,
    toggleAuditObservationStatus,
  } = useApp();

  const { currentUser, currentLang, buildings, currentBuildingId, transactions, expenses } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;

  const currentBuilding =
    (buildings || []).find((b) => b.id === currentBuildingId) || buildings?.[0] || null;
  const targetBuildingId = currentBuilding?.id || currentBuildingId;

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isManagingAdmin = Boolean(
    isAdmin && canUserManageBuilding && canUserManageBuilding(targetBuildingId)
  );
  const isActiveSzvb = Boolean(
    currentUser?.role === 'szvb' && currentBuilding && isUserBuildingSzvb(currentUser, currentBuilding)
  );
  const isActiveAuditor = Boolean(
    currentUser?.role === 'auditor' &&
      currentBuilding &&
      isUserBuildingEconomicAuditor(currentUser, currentBuilding)
  );
  const canSeeInternalObservations = Boolean(isAdmin || isActiveSzvb || isActiveAuditor);

  const [activeTab, setActiveTab] = useState('opinions'); // 'opinions' | 'observations'

  // Opinion creation state
  const [isNewOpinionOpen, setIsNewOpinionOpen] = useState(false);
  const [opYear, setOpYear] = useState(String(new Date().getFullYear() - 1));
  const [opTitle, setOpTitle] = useState('');
  const [opVerdict, setOpVerdict] = useState('approved');
  const [opSummary, setOpSummary] = useState('');
  const [opFile, setOpFile] = useState(null); // { fileName, fileType, fileSize, fileData }
  const [isSubmittingOp, setIsSubmittingOp] = useState(false);
  const [downloadingOpId, setDownloadingOpId] = useState(null);

  // Observation creation state
  const [isNewObsOpen, setIsNewObsOpen] = useState(false);
  const [obsFilter, setObsFilter] = useState('all'); // 'all' | 'open' | 'resolved'
  const [obsTitle, setObsTitle] = useState('');
  const [obsCategory, setObsCategory] = useState('bookkeeping');
  const [obsSeverity, setObsSeverity] = useState('warning');
  const [obsLinkedTxId, setObsLinkedTxId] = useState('');
  const [obsDescription, setObsDescription] = useState('');
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);

  // Comment drafts keyed by observation ID
  const [commentDrafts, setCommentDrafts] = useState({});

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (!canSeeInternalObservations) {
        setActiveTab('opinions');
      }
    } else {
      setIsNewOpinionOpen(false);
      setIsNewObsOpen(false);
    }
  }, [isOpen, canSeeInternalObservations]);

  const rawOpinions = useMemo(() => {
    const list = Array.isArray(currentBuilding?.auditOpinions) ? currentBuilding.auditOpinions : [];
    return canSeeInternalObservations ? list : list.filter((o) => o && o.publishedToOwners === true);
  }, [currentBuilding?.auditOpinions, canSeeInternalObservations]);

  const rawObservations = useMemo(() => {
    if (!canSeeInternalObservations) return [];
    return Array.isArray(currentBuilding?.auditObservations) ? currentBuilding.auditObservations : [];
  }, [currentBuilding?.auditObservations, canSeeInternalObservations]);

  const filteredObservations = useMemo(() => {
    if (obsFilter === 'all') return rawObservations;
    return rawObservations.filter((o) => (obsFilter === 'resolved' ? o.status === 'resolved' : o.status !== 'resolved'));
  }, [rawObservations, obsFilter]);

  const openObservationsCount = useMemo(
    () => rawObservations.filter((o) => o.status !== 'resolved').length,
    [rawObservations]
  );

  // Recent transactions & expenses for optional linking in observation form
  const linkableEntries = useMemo(() => {
    if (!isActiveAuditor) return [];
    const list = [];
    for (const tx of transactions || []) {
      if (!tx || tx.type === 'Correction') continue;
      list.push({
        id: tx.id,
        date: tx.date || '',
        label: `${tx.date || '-'} • +${Math.round(Math.abs(Number(tx.amount) || 0)).toLocaleString('hu-HU')} Ft • ${tx.flatNum && tx.flatNum !== 'Global' ? `${tx.flatNum}. lakás` : 'Közös'} (${tx.comment || tx.targetAccount || 'Befizetés'})`,
      });
    }
    for (const ex of expenses || []) {
      if (!ex) continue;
      list.push({
        id: ex.id,
        date: ex.date || '',
        label: `${ex.date || '-'} • -${Math.round(Math.abs(Number(ex.amount) || 0)).toLocaleString('hu-HU')} Ft • ${ex.title || ex.provider || ex.comment || 'Kiadás'}`,
      });
    }
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return list.slice(0, 60);
  }, [isActiveAuditor, transactions, expenses]);

  if (!isOpen || !currentUser || !currentBuilding) return null;

  const auditorInfo = currentBuilding.economicAuditor;

  const handleOpinionFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = await validateUploadFile(file);
    if (!check.ok) {
      if (showToast) showToast(getFileValidationErrorMessage(check.reason, t, isEn), 'error');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const ext = (check.sanitizedName.split('.').pop() || 'pdf').toLowerCase();
      setOpFile({
        fileName: check.sanitizedName,
        fileType: ext,
        fileSize: check.sizeFormatted,
        fileData: dataUrl,
      });
    } catch {
      if (showToast) showToast(isEn ? 'Failed to read file.' : 'Nem sikerült beolvasni a fájlt.', 'error');
    }
  };

  const handleSubmitOpinion = async (e) => {
    e.preventDefault();
    if (!isActiveAuditor || isSubmittingOp) return;
    setIsSubmittingOp(true);
    try {
      const res = await addAuditOpinion(targetBuildingId, {
        year: Number(opYear) || new Date().getFullYear() - 1,
        title: opTitle.trim(),
        verdict: opVerdict,
        summary: opSummary.trim(),
        fileName: opFile?.fileName || '',
        fileType: opFile?.fileType || '',
        fileSize: opFile?.fileSize || '',
        fileData: opFile?.fileData || '',
      });
      if (res?.success) {
        setOpTitle('');
        setOpSummary('');
        setOpVerdict('approved');
        setOpFile(null);
        setIsNewOpinionOpen(false);
      }
    } finally {
      setIsSubmittingOp(false);
    }
  };

  const handleDownloadOpinion = async (op) => {
    if (!op || downloadingOpId) return;
    setDownloadingOpId(op.id);
    try {
      const fileData = await fetchAuditOpinionFile(targetBuildingId, op.id);
      if (!fileData) {
        showToast(
          isEn ? 'Attached file is not available.' : 'A csatolt fájl nem érhető el.',
          'error'
        );
        return;
      }
      triggerSafeDownload(fileData, op.fileName || `ellenori_velemeny_${op.year || ''}.pdf`);
    } finally {
      setDownloadingOpId(null);
    }
  };

  const handleSubmitObservation = async (e) => {
    e.preventDefault();
    if (!isActiveAuditor || isSubmittingObs) return;
    setIsSubmittingObs(true);
    try {
      const linked = linkableEntries.find((x) => x.id === obsLinkedTxId);
      const res = await addAuditObservation(targetBuildingId, {
        title: obsTitle.trim(),
        category: obsCategory,
        severity: obsSeverity,
        linkedTxId: linked?.id || null,
        linkedTxLabel: linked?.label || '',
        description: obsDescription.trim(),
      });
      if (res?.success) {
        setObsTitle('');
        setObsDescription('');
        setObsLinkedTxId('');
        setObsSeverity('warning');
        setObsCategory('bookkeeping');
        setIsNewObsOpen(false);
      }
    } finally {
      setIsSubmittingObs(false);
    }
  };

  const handleSubmitComment = async (obsId) => {
    const text = (commentDrafts[obsId] || '').trim();
    if (!text) return;
    const res = await addAuditObservationComment(targetBuildingId, obsId, text);
    if (res?.success) {
      setCommentDrafts((prev) => ({ ...prev, [obsId]: '' }));
    }
  };

  const verdictBadge = (verdict) => {
    if (verdict === 'rejected') {
      return {
        label: isEn ? 'Not Recommended for Approval' : 'Elfogadásra nem javasolt',
        cls: 'bg-red-50 text-red-700 border-red-200',
        Icon: AlertOctagon,
      };
    }
    if (verdict === 'approved_with_notes') {
      return {
        label: isEn ? 'Approved with Notes' : 'Fenntartásokkal elfogadásra javasolt',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
        Icon: AlertTriangle,
      };
    }
    return {
      label: isEn ? 'Recommended for Approval' : 'Elfogadásra javasolt',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    };
  };

  const severityMeta = (sev) => {
    if (sev === 'critical') {
      return {
        label: isEn ? 'Critical Risk / Error' : 'Súlyos hiba / kockázat',
        cls: 'bg-red-100 text-red-800 border-red-200',
        Icon: AlertOctagon,
      };
    }
    if (sev === 'warning') {
      return {
        label: isEn ? 'Warning' : 'Figyelmeztetés',
        cls: 'bg-amber-100 text-amber-800 border-amber-200',
        Icon: AlertTriangle,
      };
    }
    return {
      label: isEn ? 'Advisory / Info' : 'Tájékoztató / Javaslat',
      cls: 'bg-blue-100 text-blue-800 border-blue-200',
      Icon: Info,
    };
  };

  const categoryLabel = (cat) => {
    const map = {
      bookkeeping: isEn ? 'Bookkeeping' : 'Könyvelés',
      invoice: isEn ? 'Invoice / Receipt' : 'Számla / Bizonylat',
      bank: isEn ? 'Bank Statement' : 'Bankkivonat',
      contract: isEn ? 'Contract' : 'Szerződés',
      budget: isEn ? 'Annual Report / Budget' : 'Elszámolás / Költségvetés',
      other: isEn ? 'Other' : 'Egyéb',
    };
    return map[cat] || map.other;
  };

  const roleBadge = (role) => {
    if (role === 'auditor') {
      return { label: isEn ? 'Financial Auditor' : 'Gazdasági ellenőr', cls: 'bg-teal-100 text-teal-800' };
    }
    if (role === 'szvb') {
      return { label: 'SZVB', cls: 'bg-indigo-100 text-indigo-800' };
    }
    return { label: isEn ? 'Management (KK)' : 'Közös Képviselet', cls: 'bg-blue-100 text-[#1E3A8A]' };
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(isEn ? 'en-GB' : 'hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={onClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Menu + NavLogoButton */}
          <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={onOpenDrawer}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                title={isHu ? 'Menü megnyitása' : 'Open Menu'}
                aria-label={isHu ? 'Menü megnyitása' : 'Open Menu'}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
              </button>
            )}
            <NavLogoButton onClick={onClose} />
          </div>

          {/* Center: Title */}
          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {t.menu_audit_review || (isEn ? 'Audit Opinions & Observations' : 'Ellenőri vélemények')}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {auditorInfo?.enabled && auditorInfo?.name
                    ? `${isEn ? 'Auditor' : 'Ellenőr'}: ${auditorInfo.name}${auditorInfo.companyName ? ` (${auditorInfo.companyName})` : ''}`
                    : currentBuilding.name}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Profile Switcher & Close */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer flex-shrink-0"
              title={isHu ? 'Bezárás' : 'Close'}
              aria-label={isHu ? 'Bezárás' : 'Close'}
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
          {/* Segmented Tab Bar (matching Finances & Building Settings) */}
          {canSeeInternalObservations && (
            <div
              role="tablist"
              className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'opinions'}
                onClick={() => setActiveTab('opinions')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'opinions'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <FileCheck2 className={`w-4 h-4 shrink-0 ${activeTab === 'opinions' ? 'text-white' : 'text-gray-500'}`} />
                <span>{isEn ? 'Written Opinions (Assembly)' : 'Írásbeli szakmai vélemények'}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'opinions' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {rawOpinions.length}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'observations'}
                onClick={() => setActiveTab('observations')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'observations'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <MessageSquareWarning className={`w-4 h-4 shrink-0 ${activeTab === 'observations' ? 'text-white' : 'text-gray-500'}`} />
                <span>{isEn ? 'Observations & SZVB Advice' : 'Szakmai észrevételek & SZVB tanácsadás'}</span>
                {openObservationsCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'observations' ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {openObservationsCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: OFFICIAL WRITTEN AUDIT OPINIONS (Tht. 51/A. §)          */}
          {/* ============================================================== */}
          {activeTab === 'opinions' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Top Action Bar */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display flex items-center gap-2">
                    <Scale className="w-4 h-4 text-teal-700" />
                    <span>
                      {isEn
                        ? 'Official Written Professional Opinions (Tht. § 51/A)'
                        : 'Hivatalos írásbeli szakmai vélemények (Tht. 51/A. §)'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isEn
                      ? 'Annual accounting and budget review opinions presented to owners ahead of the General Assembly.'
                      : 'Az éves beszámoló és a következő évi költségvetési terv felülvizsgálatáról kiadott, a közgyűlésen ismertetendő írásbeli vélemények.'}
                  </p>
                </div>

                {isActiveAuditor && !isNewOpinionOpen && (
                  <button
                    type="button"
                    onClick={() => setIsNewOpinionOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isEn ? 'New Written Opinion' : 'Új írásbeli vélemény'}</span>
                  </button>
                )}
              </div>

              {/* New Written Opinion Form (Auditor ONLY) */}
              {isActiveAuditor && isNewOpinionOpen && (
                <form
                  onSubmit={handleSubmitOpinion}
                  className="bg-white rounded-2xl border-2 border-teal-200 p-5 shadow-sm space-y-4 animate-fadeIn text-xs"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-teal-900 text-sm flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-teal-700" />
                      <span>{isEn ? 'Submit Official Written Opinion' : 'Új írásbeli szakmai vélemény rögzítése'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsNewOpinionOpen(false)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Fiscal Year' : 'Elszámolási év'} *
                      </label>
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={opYear}
                        onChange={(e) => setOpYear(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600 font-semibold"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Opinion Title' : 'Vélemény címe'} *
                      </label>
                      <input
                        type="text"
                        value={opTitle}
                        onChange={(e) => setOpTitle(e.target.value)}
                        placeholder={
                          isEn
                            ? `e.g. ${opYear} Annual Financial Statement & Budget Audit Opinion`
                            : `pl. ${opYear}. évi elszámolás és költségvetési terv ellenőri véleménye`
                        }
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1.5">
                      {isEn ? 'Professional Verdict' : 'Szakmai minősítés / Javaslat'}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'approved', label: isEn ? 'Recommended for approval' : 'Elfogadásra javasolt', activeCls: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                        { id: 'approved_with_notes', label: isEn ? 'Approved with notes' : 'Fenntartásokkal javasolt', activeCls: 'border-amber-500 bg-amber-50 text-amber-900' },
                        { id: 'rejected', label: isEn ? 'Not recommended' : 'Elfogadásra nem javasolt', activeCls: 'border-red-500 bg-red-50 text-red-900' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOpVerdict(opt.id)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            opVerdict === opt.id
                              ? opt.activeCls
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      {isEn ? 'Written Summary / Key Findings' : 'Szöveges szakmai összefoglaló'}
                    </label>
                    <textarea
                      rows={4}
                      value={opSummary}
                      onChange={(e) => setOpSummary(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Summarize key audit findings, accuracy of annual accounting, budget feasibility, and recommendations for owners...'
                          : 'Foglald össze a vizsgálat főbb megállapításait, az éves beszámoló pontosságát, a költségvetés megalapozottságát és a javaslatokat...'
                      }
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      {isEn ? 'Attach Signed PDF / DOCX Document' : 'Aláírt hivatalos dokumentum csatolása (PDF / DOCX)'}
                    </label>
                    <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-teal-500 bg-gray-50/70 hover:bg-teal-50/30 transition-colors cursor-pointer">
                      <UploadCloud className="w-4 h-4 text-teal-700" />
                      <span className="font-semibold text-gray-700">
                        {opFile
                          ? `${opFile.fileName} (${opFile.fileSize})`
                          : (isEn ? 'Choose PDF / DOCX file...' : 'PDF / DOCX fájl kiválasztása...')}
                      </span>
                      <input
                        type="file"
                        accept={ALLOWED_ACCEPT_ATTR}
                        onChange={handleOpinionFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsNewOpinionOpen(false)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer"
                    >
                      {t.cancel || (isEn ? 'Cancel' : 'Mégse')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOp}
                      className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isSubmittingOp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{isEn ? 'Submit Written Opinion' : 'Vélemény beküldése'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Opinions List */}
              {rawOpinions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-2 shadow-xs">
                  <FileCheck2 className="w-10 h-10 text-gray-300 mx-auto" />
                  <h4 className="text-sm font-bold text-gray-800">
                    {isEn ? 'No written audit opinions yet' : 'Még nincs feltöltött ellenőri írásbeli vélemény'}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    {isActiveAuditor
                      ? (isEn
                          ? 'Use the button above to upload your signed written audit opinion for the General Assembly.'
                          : 'A fenti gombbal töltheted fel az éves elszámolásról és költségvetésről készített írásbeli véleményedet.')
                      : (isEn
                          ? 'Once the Financial Auditor submits a written professional opinion, it will appear here.'
                          : 'Amint a gazdasági ellenőr feltölti a szakmai véleményét, itt megtekinthető és letölthető lesz.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rawOpinions.map((op) => {
                    const v = verdictBadge(op.verdict);
                    const VIcon = v.Icon;
                    const canDelete =
                      isManagingAdmin ||
                      (isActiveAuditor && normalizeEmail(op.authorEmail) === normalizeEmail(currentUser.email));

                    return (
                      <div
                        key={op.id}
                        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-white text-[11px] font-bold">
                                {op.year}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${v.cls}`}>
                                <VIcon className="w-3 h-3" />
                                <span>{v.label}</span>
                              </span>
                              {canSeeInternalObservations && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    op.publishedToOwners
                                      ? 'bg-blue-50 text-[#1E3A8A] border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}
                                >
                                  {op.publishedToOwners ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  <span>
                                    {op.publishedToOwners
                                      ? (isEn ? 'Published to Owners' : 'Közzétéve lakóknak')
                                      : (isEn ? 'Internal (KK & SZVB)' : 'Belső (KK és SZVB)')}
                                  </span>
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-gray-900 font-display">
                              {op.title}
                            </h4>
                            <div className="text-[11px] text-gray-500">
                              {op.authorName} &bull; {formatDate(op.createdAt)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {(op.hasCloudFile || op.fileData || op.fileName) && (
                              <button
                                type="button"
                                disabled={downloadingOpId === op.id}
                                onClick={() => handleDownloadOpinion(op)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                              >
                                {downloadingOpId === op.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>{op.fileName || (isEn ? 'Download PDF' : 'Dokumentum letöltése')}</span>
                              </button>
                            )}

                            {isManagingAdmin && (
                              <button
                                type="button"
                                onClick={() => toggleAuditOpinionPublish(targetBuildingId, op.id)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                  op.publishedToOwners
                                    ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                    : 'bg-[#1E3A8A] border-[#1E3A8A] text-white hover:bg-[#1e40af]'
                                }`}
                                title={
                                  op.publishedToOwners
                                    ? (isEn ? 'Hide from owners' : 'Közzététel visszavonása')
                                    : (isEn ? 'Publish to all owners for assembly' : 'Közzététel minden tulajdonosnak a közgyűléshez')
                                }
                              >
                                {op.publishedToOwners ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                <span>
                                  {op.publishedToOwners
                                    ? (isEn ? 'Unpublish' : 'Elrejtés')
                                    : (isEn ? 'Publish to Owners' : 'Közzététel lakóknak')}
                                </span>
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      isEn
                                        ? 'Delete this written audit opinion?'
                                        : 'Biztosan törlöd ezt az ellenőri írásbeli véleményt?'
                                    )
                                  ) {
                                    deleteAuditOpinion(targetBuildingId, op.id);
                                  }
                                }}
                                className="p-1.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                                title={t.delete || (isEn ? 'Delete' : 'Törlés')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {op.summary && (
                          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                            {op.summary}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: AUDIT OBSERVATIONS & SZVB CONSULTATION LOG              */}
          {/* ============================================================== */}
          {activeTab === 'observations' && canSeeInternalObservations && (
            <div className="space-y-4 animate-fadeIn">
              {/* Header + Filter Bar */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display flex items-center gap-2">
                    <MessageSquareWarning className="w-4 h-4 text-amber-600" />
                    <span>
                      {isEn
                        ? 'Audit Observations, Risk Flags & SZVB Advice'
                        : 'Szakmai észrevételek, kockázatjelzések & SZVB tanácsadás'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isEn
                      ? 'Internal consultation channel between the Financial Auditor, SZVB, and Common Representative. Accounting entries remain strictly untouched.'
                      : 'Belső szakmai egyeztetési napló a Gazdasági ellenőr, az SZVB és a Közös Képviselet között. A könyvelési tételek érintetlenek maradnak.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                    {[
                      { id: 'all', label: `${isEn ? 'All' : 'Összes'} (${rawObservations.length})` },
                      { id: 'open', label: `${isEn ? 'Open' : 'Nyitott'} (${openObservationsCount})` },
                      { id: 'resolved', label: `${isEn ? 'Resolved' : 'Tisztázva'} (${rawObservations.length - openObservationsCount})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setObsFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                          obsFilter === f.id ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {isActiveAuditor && !isNewObsOpen && (
                    <button
                      type="button"
                      onClick={() => setIsNewObsOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'New Observation' : 'Új észrevétel'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* New Observation Form (Auditor ONLY) */}
              {isActiveAuditor && isNewObsOpen && (
                <form
                  onSubmit={handleSubmitObservation}
                  className="bg-white rounded-2xl border-2 border-teal-200 p-5 shadow-sm space-y-4 animate-fadeIn text-xs"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-teal-900 text-sm flex items-center gap-2">
                      <MessageSquareWarning className="w-4 h-4 text-teal-700" />
                      <span>{isEn ? 'Log Professional Observation / Risk Flag' : 'Új szakmai észrevétel / kockázatjelzés'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsNewObsOpen(false)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Subject / Short Title' : 'Észrevétel tárgya'} *
                      </label>
                      <input
                        type="text"
                        value={obsTitle}
                        onChange={(e) => setObsTitle(e.target.value)}
                        placeholder={
                          isEn
                            ? 'e.g. Missing invoice attachment for April utility transfer'
                            : 'pl. Hiányzó számlabizonylat az áprilisi közüzemi utaláshoz'
                        }
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Area / Category' : 'Terület / Kategória'}
                      </label>
                      <select
                        value={obsCategory}
                        onChange={(e) => setObsCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                      >
                        <option value="bookkeeping">{isEn ? 'Bookkeeping' : 'Könyvelés'}</option>
                        <option value="invoice">{isEn ? 'Invoice / Receipt' : 'Számla / Bizonylat'}</option>
                        <option value="bank">{isEn ? 'Bank Statement' : 'Bankkivonat'}</option>
                        <option value="contract">{isEn ? 'Contract' : 'Szerződés'}</option>
                        <option value="budget">{isEn ? 'Annual Report / Budget' : 'Elszámolás / Költségvetés'}</option>
                        <option value="other">{isEn ? 'Other' : 'Egyéb'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Severity' : 'Súlyosság'}
                      </label>
                      <select
                        value={obsSeverity}
                        onChange={(e) => setObsSeverity(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                      >
                        <option value="info">{isEn ? 'Advisory / Info' : 'Tájékoztató / Javaslat'}</option>
                        <option value="warning">{isEn ? 'Warning / Needs Clarification' : 'Figyelmeztetés / Tisztázandó'}</option>
                        <option value="critical">{isEn ? 'Critical Risk / Accounting Error' : 'Súlyos hiba / pénzügyi kockázat'}</option>
                      </select>
                    </div>

                    {linkableEntries.length > 0 && (
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-gray-700 mb-1">
                          {isEn ? 'Link Specific Accounting Entry (Optional)' : 'Kapcsolódó könyvelési tétel megjelölése (opcionális)'}
                        </label>
                        <select
                          value={obsLinkedTxId}
                          onChange={(e) => setObsLinkedTxId(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                        >
                          <option value="">{isEn ? '— General observation (no specific entry) —' : '— Általános észrevétel (nincs tételhez kötve) —'}</option>
                          {linkableEntries.map((ent) => (
                            <option key={ent.id} value={ent.id}>
                              {ent.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-gray-700 mb-1">
                        {isEn ? 'Detailed Finding & Advice for SZVB / Management' : 'Részletes szakmai leírás és javaslat'} *
                      </label>
                      <textarea
                        rows={3}
                        value={obsDescription}
                        onChange={(e) => setObsDescription(e.target.value)}
                        placeholder={
                          isEn
                            ? 'Explain the issue, legal/accounting impact, and recommended corrective action...'
                            : 'Írd le pontosan a megállapítást, a számviteli/jogszabályi kockázatot és a javasolt teendőt...'
                        }
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsNewObsOpen(false)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer"
                    >
                      {t.cancel || (isEn ? 'Cancel' : 'Mégse')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingObs}
                      className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isSubmittingObs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isEn ? 'Record Observation' : 'Észrevétel rögzítése'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Observations List */}
              {filteredObservations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center space-y-2 shadow-xs">
                  <MessageSquareWarning className="w-10 h-10 text-gray-300 mx-auto" />
                  <h4 className="text-sm font-bold text-gray-800">
                    {isEn ? 'No audit observations recorded' : 'Nincs rögzített szakmai észrevétel'}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    {isEn
                      ? 'Audit risk flags, missing-document notes, and professional advice for the SZVB will appear here.'
                      : 'A gazdasági ellenőr által jelzett könyvelési észrevételek, hiánypótlások és az SZVB-nek szóló szakmai tanácsok itt jelennek meg.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredObservations.map((obs) => {
                    const sev = severityMeta(obs.severity);
                    const SIcon = sev.Icon;
                    const isResolved = obs.status === 'resolved';
                    const canToggleStatus = isActiveAuditor || isManagingAdmin;
                    const canComment = isActiveAuditor || isActiveSzvb || isManagingAdmin;
                    const draft = commentDrafts[obs.id] || '';

                    return (
                      <div
                        key={obs.id}
                        className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3 transition-colors ${
                          isResolved ? 'border-gray-200 opacity-90' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${sev.cls}`}>
                                <SIcon className="w-3 h-3" />
                                <span>{sev.label}</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-semibold">
                                {categoryLabel(obs.category)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isResolved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isResolved ? (isEn ? 'Resolved' : 'Tisztázva') : (isEn ? 'Open' : 'Nyitott')}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900">{obs.title}</h4>
                            <div className="text-[11px] text-gray-500">
                              {obs.authorName} &bull; {formatDate(obs.createdAt)}
                              {isResolved && obs.resolvedBy && (
                                <span className="text-emerald-700 font-medium">
                                  {' '}• {isEn ? 'Resolved by' : 'Tisztázta'}: {obs.resolvedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          {canToggleStatus && (
                            <button
                              type="button"
                              onClick={() => toggleAuditObservationStatus(targetBuildingId, obs.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors shrink-0 ${
                                isResolved
                                  ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {isResolved ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>
                                {isResolved
                                  ? (isEn ? 'Reopen' : 'Újranyitás')
                                  : (isEn ? 'Mark Resolved' : 'Tisztázottnak jelölés')}
                              </span>
                            </button>
                          )}
                        </div>

                        {obs.linkedTxLabel && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-semibold text-[#1E3A8A]">
                            <Receipt className="w-3.5 h-3.5 shrink-0" />
                            <span>{obs.linkedTxLabel}</span>
                          </div>
                        )}

                        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                          {obs.description}
                        </div>

                        {/* Consultation Thread */}
                        <div className="pt-2 border-t border-gray-100 space-y-2.5">
                          {(obs.comments || []).length > 0 && (
                            <div className="space-y-2">
                              {obs.comments.map((c) => {
                                const rb = roleBadge(c.authorRole);
                                return (
                                  <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-gray-900">{c.authorName}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${rb.cls}`}>
                                          {rb.label}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-gray-400">{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-line">{c.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {canComment && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={draft}
                                onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [obs.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmitComment(obs.id);
                                  }
                                }}
                                placeholder={
                                  isEn
                                    ? 'Add a reply or professional consultation note...'
                                    : 'Válasz vagy szakmai megjegyzés hozzáfűzése...'
                                }
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                              />
                              <button
                                type="button"
                                disabled={!draft.trim()}
                                onClick={() => handleSubmitComment(obs.id)}
                                className="px-3 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{isEn ? 'Send' : 'Küldés'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
