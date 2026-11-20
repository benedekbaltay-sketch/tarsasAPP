import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Landmark, 
  Menu, 
  Plus, 
  Coins, 
  Users, 
  History, 
  Archive, 
  TrendingDown, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  Download, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  ArrowRight,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  Clock,
  Sparkles
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { formatCurrency } from '../../utils/finances';
import { 
  calculateLoanStats, 
  calculateLoanProgress, 
  calculatePaymentTotals 
} from '../../utils/loans';
import { 
  exportLoanPaymentsToExcel, 
  exportLoanParticipantsToExcel, 
  exportLoanPaymentsToCSV, 
  exportLoanParticipantsToCSV 
} from '../../utils/exportExcel';
import { NewLoanModal } from './LoanModals/NewLoanModal';
import { RecordPaymentModal } from './LoanModals/RecordPaymentModal';

export function LoansModal({ isOpen, onClose, onOpenDrawer, onOpenProfileSelector, embedded = false }) {
  const { state, t, deleteLoan, deleteLoanPayment } = useApp();
  const { currentUser, currentLang, loans = [] } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Navigation tab state: 'active' | 'participants' | 'history' | 'archive'
  const [activeTab, setActiveTab] = useState('active');

  // Selected loan for detailed views (participants / history)
  const [selectedLoanId, setSelectedLoanId] = useState(null);

  // Modals state
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [editingLoanData, setEditingLoanData] = useState(null);
  const [paymentModalLoan, setPaymentModalLoan] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all'); // 'all' | 'lump_sum' | 'financed'

  useEffect(() => {
    if (isOpen) {
      if (!embedded) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    } else {
      setActiveTab('active');
      setSelectedLoanId(null);
      setIsNewLoanOpen(false);
      setEditingLoanData(null);
      setPaymentModalLoan(null);
      setSearchQuery('');
      setMethodFilter('all');
    }
  }, [isOpen, embedded]);

  // Active vs Archived loans
  const activeLoans = useMemo(() => {
    return (loans || []).filter(l => l && l.status !== 'paid_off');
  }, [loans]);

  const archivedLoans = useMemo(() => {
    return (loans || []).filter(l => l && l.status === 'paid_off');
  }, [loans]);

  // Aggregate Dashboard stats
  const stats = useMemo(() => {
    return calculateLoanStats(loans);
  }, [loans]);

  // Automatically select first active loan if none selected
  useEffect(() => {
    if (!selectedLoanId) {
      if (activeLoans.length > 0) {
        setSelectedLoanId(activeLoans[0].id);
      } else if (archivedLoans.length > 0) {
        setSelectedLoanId(archivedLoans[0].id);
      }
    }
  }, [activeLoans, archivedLoans, selectedLoanId]);

  const currentSelectedLoan = useMemo(() => {
    return (loans || []).find(l => l.id === selectedLoanId) || activeLoans[0] || archivedLoans[0] || null;
  }, [loans, selectedLoanId, activeLoans, archivedLoans]);

  // Filtered participants for selected loan
  const filteredParticipants = useMemo(() => {
    if (!currentSelectedLoan || !Array.isArray(currentSelectedLoan.participants)) return [];
    return currentSelectedLoan.participants.filter(p => {
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (p.apartmentId && String(p.apartmentId).toLowerCase().includes(q)) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(q))
      );
    });
  }, [currentSelectedLoan, methodFilter, searchQuery]);

  if (!isOpen || !currentUser) return null;

  const loansBodyContent = (
    <div className={embedded ? "space-y-6 animate-fadeIn" : "max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-6"}>
      {/* Compact Embedded Section Header with "+ Új hitel rögzítése" button */}
      {embedded && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
                {isEn ? "Condominium Loans & Renovation Funds" : "Társasházi hitelek és célbefizetések"}
              </h3>
              <span className="text-xs text-gray-500 block truncate">
                {stats.activeLoansCount} {isEn ? "active loans" : "aktív hitel"} • {formatCurrency(stats.totalRemainingDebt)} {isEn ? "debt" : "fennmaradó tőke"}
              </span>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingLoanData(null);
                setIsNewLoanOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs shadow-purple-200 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? "New Loan" : "Új hitel rögzítése"}</span>
            </button>
          )}
        </div>
      )}

      {/* A) ÖSSZESÍTŐ KÁRTYÁK (Dashboard KPI Header) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            
            {/* KPI 1: Összes fennmaradó hiteltartozás */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-100 shadow-xs relative overflow-hidden group">
              <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {isEn ? "Total Remaining Debt" : "Összes fennmaradó hiteltartozás"}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-purple-950 font-display">
                {formatCurrency(stats.totalRemainingDebt)}
              </div>
              <span className="text-[11px] text-purple-700/80 font-medium mt-1 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {isEn ? "Bank principal liability" : "Banki tőketartozás"}
              </span>
            </div>

            {/* KPI 2: Havi összes törlesztési kötelezettség */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-xs relative overflow-hidden group">
              <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {isEn ? "Total Monthly Installments" : "Havi összes törlesztő"}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-indigo-950 font-display">
                {formatCurrency(stats.totalMonthlyInstallment)}
                <span className="text-xs text-gray-400 font-normal ml-1">/ {isEn ? "mo" : "hó"}</span>
              </div>
              <span className="text-[11px] text-indigo-700/80 font-medium mt-1 block">
                {isEn ? "Distributed to financed flats" : "Finanszírozott lakókra terhelve"}
              </span>
            </div>

            {/* KPI 3: Összesen befizetett egyösszegű önrész */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-xs relative overflow-hidden group">
              <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {isEn ? "Total Lump Sum Collected" : "Befizetett egyösszegű önrész"}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-950 font-display">
                +{formatCurrency(stats.totalLumpSumCollected)}
              </div>
              <span className="text-[11px] text-emerald-700/80 font-medium mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isEn ? "Paid up-front (exempt)" : "Zsebből fizetve (mentesültek)"}
              </span>
            </div>

            {/* KPI 4: Aktív hitelek száma */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs relative overflow-hidden group">
              <div className="absolute right-3 top-3 w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-gray-500 block mb-1">
                {isEn ? "Active Projects" : "Aktív projektek"}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold text-gray-900 font-display">
                {stats.activeLoansCount} <span className="text-xs text-gray-400 font-normal">/ {loans.length} {isEn ? "total" : "összes"}</span>
              </div>
              <span className="text-[11px] text-gray-500 font-medium mt-1 block">
                {stats.paidOffLoansCount} {isEn ? "closed / paid off" : "lezárt / kifizetett"}
              </span>
            </div>
          </div>

          {/* B) FŐ NAVIGÁCIÓ / TABS */}
          <div className="bg-white rounded-2xl p-1.5 border border-gray-200 shadow-2xs flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Landmark className="w-4 h-4" />
              <span>{isEn ? "Active Loans" : "Aktív hitelek"}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'active' ? 'bg-purple-700 text-purple-100' : 'bg-gray-100 text-gray-600'}`}>
                {activeLoans.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'participants'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isEn ? "Participants & Exemptions" : "Résztvevők & Mentesülések"}</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{isEn ? "Payment Log" : "Törlesztési napló"}</span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>{isEn ? "Closed / Archive" : "Lezárt / Múltbeli hitelek"}</span>
              {archivedLoans.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'archive' ? 'bg-purple-700 text-purple-100' : 'bg-gray-100 text-gray-600'}`}>
                  {archivedLoans.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: AKTÍV HITELEK (Card-based view) */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {activeLoans.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
                    <Landmark className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">
                    {isEn ? "No active condominium loans" : "Nincs aktív társasházi hitel"}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
                    {isEn 
                      ? "When the building takes out a bank loan for renovation, record it here to track principal balance and resident installment allocation."
                      : "Ha a társasház felújítási célú bankhitelt vesz fel, rögzítsd itt a tőketartozás és a lakónkénti törlesztőrészletek pontos elszámolásához."}
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingLoanData(null);
                        setIsNewLoanOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-200 cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? "Record First Loan" : "Első hitel rögzítése"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5">
                  {activeLoans.map(loan => {
                    const progress = calculateLoanProgress(loan);
                    const paidPrincipal = Math.max(0, (Number(loan.principalAmount) || 0) - (Number(loan.currentBalance) || 0));

                    return (
                      <div 
                        key={loan.id}
                        className="bg-white rounded-3xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow p-5 sm:p-6 space-y-5"
                      >
                        {/* Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-purple-200">
                              <Landmark className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 font-display">
                                  {loan.title}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {isEn ? "Active" : "Aktív"}
                                </span>
                                {loan.bankName && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                                    {loan.bankName}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {loan.contractNumber ? `${isEn ? "Contract" : "Szerződés"}: ${loan.contractNumber} • ` : ''}
                                {isEn ? "Start" : "Folyósítás"}: {loan.startDate} • {isEn ? "Maturity" : "Lejárat"}: {loan.endDate || '-'}
                              </p>
                            </div>
                          </div>

                          {/* Quick Card Action Buttons */}
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            {isAdmin && (
                              <button
                                onClick={() => setPaymentModalLoan(loan)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>{isEn ? "Record Payment" : "Törlesztés rögzítése"}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setActiveTab('participants');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              <Users className="w-3.5 h-3.5 text-gray-500" />
                              <span>{isEn ? "Details & Allocation" : "Részletek & Lakói leosztás"}</span>
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingLoanData(loan);
                                    setIsNewLoanOpen(true);
                                  }}
                                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-purple-600 cursor-pointer transition-colors"
                                  title={isEn ? "Edit Loan" : "Hitel szerkesztése"}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(isEn ? `Are you sure you want to delete loan: ${loan.title}?` : `Biztosan törölni szeretnéd a következő hitelt: ${loan.title}?`)) {
                                      deleteLoan(loan.id);
                                    }
                                  }}
                                  className="p-2 rounded-xl border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer transition-colors"
                                  title={isEn ? "Delete Loan" : "Hitel törlése"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Financial Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-100 text-xs">
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Total Project Cost" : "Teljes projektköltség"}</span>
                            <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(loan.totalProjectCost || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Lump Sum Collected" : "Zsebből befolyt önrész"}</span>
                            <span className="font-bold text-emerald-700 text-sm font-display">+{formatCurrency(loan.lumpSumTotalCollected || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Actual Bank Loan" : "Tényleges hitelösszeg"}</span>
                            <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(loan.principalAmount || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Current Remaining" : "Jelenlegi tőketartozás"}</span>
                            <span className="font-extrabold text-purple-900 text-sm font-display">{formatCurrency(loan.currentBalance || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Monthly Installment" : "Havi törlesztő"}</span>
                            <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(loan.monthlyInstallment || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Term / Interest" : "Futamidő / Kamat"}</span>
                            <span className="font-semibold text-gray-800 text-sm">
                              {loan.termMonths} {isEn ? "mo" : "hó"} {loan.interestRatePercent ? `• ${loan.interestRatePercent}%` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Repayment Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>{isEn ? "Principal Repayment Progress:" : "Tőketörlesztési haladás:"}</span>
                              <strong className="text-purple-900">{progress}%</strong>
                            </span>
                            <span className="text-gray-500 font-display">
                              {formatCurrency(paidPrincipal)} / {formatCurrency(loan.principalAmount || 0)}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500 shadow-2xs"
                              style={{ width: `${Math.max(3, progress)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RÉSZTVEVŐK & MENTESÜLÉSEK (Detailed table view) */}
          {activeTab === 'participants' && (
            <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 space-y-5 shadow-xs">
              
              {/* Header with Loan Selector & Export */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-display">
                      {isEn ? "Resident Participation & Exemption List" : "Lakói részvétel és mentesülési névsor"}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isEn ? "Financed vs. lump sum paid flats" : "Zsebből egyösszegben kifizetett és hitelben törlesztő lakások kimutatása"}
                    </p>
                  </div>
                </div>

                {/* Loan Selector Dropdown if multiple loans */}
                <div className="flex items-center gap-2">
                  {loans.length > 1 && (
                    <select
                      value={selectedLoanId || ''}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    >
                      {loans.map(l => (
                        <option key={l.id} value={l.id}>{l.title} ({l.status === 'paid_off' ? (isEn ? 'Closed' : 'Lezárt') : (isEn ? 'Active' : 'Aktív')})</option>
                      ))}
                    </select>
                  )}

                  {/* Export Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => exportLoanParticipantsToExcel(currentSelectedLoan, isEn)}
                      disabled={!currentSelectedLoan}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                      title={isEn ? "Export to Excel (.xlsx)" : "Exportálás Excelbe (.xlsx)"}
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={() => exportLoanParticipantsToCSV(currentSelectedLoan, isEn)}
                      disabled={!currentSelectedLoan}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                      title="Exportálás CSV formátumban"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isEn ? "Search flat or owner..." : "Keresés lakásra vagy tulajdonosra..."}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-purple-500"
                  />
                </div>

                {/* Method Filter Toggle */}
                <div className="inline-flex rounded-xl p-1 bg-gray-100 border border-gray-200 text-xs self-start sm:self-auto">
                  <button
                    onClick={() => setMethodFilter('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      methodFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {isEn ? "All Flats" : "Összes lakás"} ({currentSelectedLoan?.participants?.length || 0})
                  </button>
                  <button
                    onClick={() => setMethodFilter('lump_sum')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      methodFilter === 'lump_sum' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {isEn ? "Lump Sum (Exempt)" : "Zsebből fizetett (Mentesült)"} ({currentSelectedLoan?.participants?.filter(p => p.paymentMethod === 'lump_sum').length || 0})
                  </button>
                  <button
                    onClick={() => setMethodFilter('financed')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      methodFilter === 'financed' ? 'bg-white text-purple-800 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {isEn ? "Financed" : "Hitelben törlesztő"} ({currentSelectedLoan?.participants?.filter(p => p.paymentMethod === 'financed').length || 0})
                  </button>
                </div>
              </div>

              {/* Participants Table */}
              {!currentSelectedLoan ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {isEn ? "No loan selected." : "Nincs kiválasztott hitel."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">{isEn ? "Flat" : "Lakásszám"}</th>
                        <th className="py-3 px-4">{isEn ? "Owner" : "Tulajdonos"}</th>
                        <th className="py-3 px-4">{isEn ? "Area" : "Terület"}</th>
                        <th className="py-3 px-4 text-center">{isEn ? "Payment Method" : "Fizetési mód"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Lump Sum Equity Paid" : "Beérkezett egyösszegű önrész"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Monthly Contribution" : "Havi rá eső törlesztő"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredParticipants.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            {isEn ? "No participants match the search criteria." : "Nincs a szűrésnek megfelelő lakás."}
                          </td>
                        </tr>
                      ) : (
                        filteredParticipants.map(p => {
                          const isLump = p.paymentMethod === 'lump_sum';
                          return (
                            <tr key={p.apartmentId} className={`hover:bg-gray-50 transition-colors ${isLump ? 'bg-emerald-50/20' : ''}`}>
                              <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                                {p.apartmentId}. {isEn ? "flat" : "lakás"}
                              </td>
                              <td className="py-3 px-4 text-gray-700 font-medium">
                                {p.ownerName}
                              </td>
                              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                                {p.area ? `${p.area} m²` : '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isLump ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    <span>{isEn ? "Lump Sum (Exempt)" : "Egyösszegű (Zsebből - Mentesült)"}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Receipt className="w-3 h-3 text-purple-600" />
                                    <span>{isEn ? "Financed Installment" : "Hitelben törlesztő"}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-display whitespace-nowrap">
                                {isLump ? (
                                  <span className="font-bold text-emerald-700 text-xs">
                                    +{formatCurrency(p.lumpSumAmountPaid || 0)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic text-[11px]">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-display whitespace-nowrap">
                                {!isLump ? (
                                  <span className="font-extrabold text-purple-900 text-xs">
                                    {formatCurrency(p.monthlyContribution || 0)} / {isEn ? "mo" : "hó"}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-semibold text-[11px]">
                                    0 Ft ({isEn ? "Exempt from loan fee" : "Mentesült a havi törlesztő alól"})
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TÖRLESZTÉSI NAPLÓ (Payment History View) */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 space-y-5 shadow-xs">
              
              {/* Header with Loan Selector & Export */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-display">
                      {isEn ? "Bank Payment Log" : "Bank felé teljesített törlesztési napló"}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isEn ? "Record and track monthly principal, interest and fee payments" : "Havi banki befizetések, tőke, kamat és banki díjak nyomon követése"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {loans.length > 1 && (
                    <select
                      value={selectedLoanId || ''}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    >
                      {loans.map(l => (
                        <option key={l.id} value={l.id}>{l.title}</option>
                      ))}
                    </select>
                  )}

                  {isAdmin && currentSelectedLoan && currentSelectedLoan.status !== 'paid_off' && (
                    <button
                      onClick={() => setPaymentModalLoan(currentSelectedLoan)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isEn ? "Record Payment" : "Új törlesztés"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => exportLoanPaymentsToExcel(currentSelectedLoan, isEn)}
                    disabled={!currentSelectedLoan}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => exportLoanPaymentsToCSV(currentSelectedLoan, isEn)}
                    disabled={!currentSelectedLoan}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Payment Totals Pill */}
              {currentSelectedLoan && (
                (() => {
                  const pTotals = calculatePaymentTotals(currentSelectedLoan.payments);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100 text-xs">
                      <div>
                        <span className="text-gray-500 block">{isEn ? "Total Paid to Bank:" : "Összes kifizetett összeg:"}</span>
                        <span className="font-extrabold text-purple-950 text-sm font-display">{formatCurrency(pTotals.totalPaid)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{isEn ? "Total Principal Paid:" : "Kifizetett tőkerész:"}</span>
                        <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(pTotals.principalPaid)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{isEn ? "Total Interest Paid:" : "Kifizetett kamat:"}</span>
                        <span className="font-bold text-amber-700 text-sm font-display">{formatCurrency(pTotals.interestPaid)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{isEn ? "Remaining Balance:" : "Fennmaradó tőketartozás:"}</span>
                        <span className="font-extrabold text-purple-900 text-sm font-display">{formatCurrency(currentSelectedLoan.currentBalance || 0)}</span>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Payments Table */}
              {!currentSelectedLoan || !currentSelectedLoan.payments || currentSelectedLoan.payments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {isEn ? "No payments recorded yet for this loan." : "Még nem került rögzítésre törlesztés ehhez a hitelhez."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">{isEn ? "Date" : "Dátum"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Total Paid" : "Befizetett összeg"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Principal" : "Tőke"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Interest" : "Kamat"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Bank Fee" : "Díj"}</th>
                        <th className="py-3 px-4 text-right">{isEn ? "Remaining Principal" : "Fennmaradó tőke"}</th>
                        <th className="py-3 px-4">{isEn ? "Note" : "Megjegyzés"}</th>
                        <th className="py-3 px-4 text-center">{isEn ? "Status" : "Státusz"}</th>
                        {isAdmin && <th className="py-3 px-3 text-right"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentSelectedLoan.payments.map((p, pIdx) => (
                        <tr key={p.id || pIdx} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                            {p.paymentDate}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-purple-900 font-display whitespace-nowrap">
                            {formatCurrency(p.totalPaid || 0)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900 font-display whitespace-nowrap">
                            {formatCurrency(p.principalPaid || 0)}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-700 font-display whitespace-nowrap">
                            {formatCurrency(p.interestPaid || 0)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500 font-display whitespace-nowrap">
                            {p.bankFee ? formatCurrency(p.bankFee) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-gray-900 font-display whitespace-nowrap">
                            {formatCurrency(p.remainingBalanceAfter !== undefined ? p.remainingBalanceAfter : 0)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 truncate max-w-[180px]">
                            {p.note || '-'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {p.status === 'completed' ? (isEn ? "Completed" : "Teljesítve") : (isEn ? "Pending" : "Függőben")}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  if (window.confirm(isEn ? "Delete this payment record?" : "Biztosan törölni szeretnéd ezt a törlesztési tételt?")) {
                                    deleteLoanPayment(currentSelectedLoan.id, p.id);
                                  }
                                }}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                                title="Tétel törlése"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LEZÁRT / MÚLTBELI HITELEK (Archived View) */}
          {activeTab === 'archive' && (
            <div className="space-y-4">
              {archivedLoans.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mx-auto mb-4">
                    <Archive className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">
                    {isEn ? "No closed or past loans" : "Nincs lezárt vagy múltbeli hitel"}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    {isEn 
                      ? "When a loan's remaining principal reaches 0 HUF, it is automatically archived here with its full repayment history preserved."
                      : "Amikor egy hitel fennmaradó tőketartozása eléri a 0 Ft-ot, automatikusan ide kerül az archívumba a teljes kifizetési előzménnyel együtt."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5">
                  {archivedLoans.map(loan => {
                    const pTotals = calculatePaymentTotals(loan.payments);
                    return (
                      <div 
                        key={loan.id}
                        className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4 opacity-95"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
                              <Archive className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-gray-900 font-display">{loan.title}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                                  {isEn ? "Paid Off" : "Kifizetve / Lezárva"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {loan.bankName} • {isEn ? "Period" : "Időszak"}: {loan.startDate} - {loan.endDate || '-'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setActiveTab('history');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              {isEn ? "View Payment History" : "Törlesztési előzmények"}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setActiveTab('participants');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              {isEn ? "Participants" : "Résztvevők"}
                            </button>
                          </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-2xl text-xs">
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Initial Principal" : "Kezdeti felvett tőke"}</span>
                            <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(loan.principalAmount || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Total Principal Paid" : "Összes törlesztett tőke"}</span>
                            <span className="font-bold text-emerald-700 text-sm font-display">{formatCurrency(pTotals.principalPaid || loan.principalAmount || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Total Interest Paid" : "Kifizetett banki kamat"}</span>
                            <span className="font-bold text-amber-700 text-sm font-display">{formatCurrency(pTotals.interestPaid || 0)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">{isEn ? "Lump Sum Equity" : "Zsebből fizetett önrész"}</span>
                            <span className="font-bold text-gray-900 text-sm font-display">{formatCurrency(loan.lumpSumTotalCollected || 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
  );

  const loanActionModals = (
    <>
      {/* Modal 1: New / Edit Loan Modal */}
      <NewLoanModal
        isOpen={isNewLoanOpen}
        onClose={() => {
          setIsNewLoanOpen(false);
          setEditingLoanData(null);
        }}
        initialData={editingLoanData}
      />

      {/* Modal 2: Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(paymentModalLoan)}
        onClose={() => setPaymentModalLoan(null)}
        loan={paymentModalLoan}
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {loansBodyContent}
        {loanActionModals}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Top Header Container */}
      <div className="sticky top-0 z-20 w-full shadow-xs">
        <ImpersonationBanner onExit={onClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={onOpenDrawer}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                title={isEn ? "Open Menu" : "Menü megnyitása"}
                aria-label={isEn ? "Open Menu" : "Menü megnyitása"}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
              </button>
            )}
            <NavLogoButton onClick={onClose} />
          </div>

          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[60%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {isEn ? "Condominium Loans & Renovation Funds" : "Társasházi hitelek és célbefizetések"}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {stats.activeLoansCount} {isEn ? "active loans" : "aktív hitel"} • {formatCurrency(stats.totalRemainingDebt)} {isEn ? "debt" : "fennmaradó tőke"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingLoanData(null);
                  setIsNewLoanOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs shadow-purple-200 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">{isEn ? "New Loan" : "Új hitel rögzítése"}</span>
              </button>
            )}
            <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
          </div>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loansBodyContent}
      </div>

      {loanActionModals}
    </div>
  );
}
