import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Mail, 
  Bell, 
  Settings2, 
  History, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  CheckCheck, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  Sparkles, 
  Eye, 
  Send, 
  Filter, 
  Building2, 
  ArrowUpRight, 
  CheckCircle2, 
  FileText,
  Play,
  Calculator,
  Calendar
} from 'lucide-react';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { EditEmailRuleModal } from './EditEmailRuleModal';
import { 
  DEFAULT_DUNNING_RULES, 
  runDunningDryRun, 
  renderEmailTemplate 
} from '../../utils/dunningRules.js';
import { formatCurrency } from '../../utils/finances.js';
import { getNotificationsForUser } from '../../utils/teamPermissions.js';

function formatTime(iso, isEn) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(isEn ? 'en-GB' : 'hu-HU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

export function CommunicationCenterModal({
  isOpen,
  initialBuildingId = 'all',
  onClose
}) {
  const { 
    state, 
    t, 
    markNotificationRead, 
    markAllNotificationsRead, 
    dismissNotification,
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems,
    showToast
  } = useApp();

  const { currentUser, currentLang, buildings, notifications, emailRules, emailOutbox, repProfile } = state;
  const isEn = currentLang === 'en';

  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'rules' | 'outbox'
  const [selectedBuildingId, setSelectedBuildingId] = useState(initialBuildingId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [isEditRuleOpen, setIsEditRuleOpen] = useState(false);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [ruleDryRunTarget, setRuleDryRunTarget] = useState(null);

  // Fallback to default dunning rules if not initialized
  const activeRules = useMemo(() => {
    return Array.isArray(emailRules) && emailRules.length > 0
      ? emailRules
      : DEFAULT_DUNNING_RULES;
  }, [emailRules]);

  // Notifications belonging to current user
  const userNotifications = useMemo(() => {
    return getNotificationsForUser(notifications || [], currentUser);
  }, [notifications, currentUser]);

  const filteredNotifications = useMemo(() => {
    return userNotifications.filter(n => {
      if (selectedBuildingId !== 'all' && n.buildingId && n.buildingId !== selectedBuildingId) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = (isEn ? (n.titleEn || n.titleHu) : (n.titleHu || n.titleEn)) || '';
      const msg = (isEn ? (n.messageEn || n.messageHu) : (n.messageHu || n.messageEn)) || '';
      return title.toLowerCase().includes(q) || msg.toLowerCase().includes(q);
    });
  }, [userNotifications, selectedBuildingId, searchQuery, isEn]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return activeRules.filter(r => {
      if (selectedBuildingId !== 'all' && r.buildingId && r.buildingId !== 'all' && r.buildingId !== selectedBuildingId) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (isEn ? (r.nameEn || r.name) : (r.name || r.nameEn)) || '';
      const desc = (isEn ? (r.descriptionEn || r.description) : (r.description || r.descriptionEn)) || '';
      return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    });
  }, [activeRules, selectedBuildingId, searchQuery, isEn]);

  // Outbox items
  const outboxItems = useMemo(() => {
    return (emailOutbox || []).filter(item => {
      if (selectedBuildingId !== 'all' && item.buildingId && item.buildingId !== selectedBuildingId) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (item.recipientName && item.recipientName.toLowerCase().includes(q)) ||
        (item.recipientEmail && item.recipientEmail.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.ruleName && item.ruleName.toLowerCase().includes(q)) ||
        (item.flatNum && item.flatNum.toString().includes(q))
      );
    });
  }, [emailOutbox, selectedBuildingId, searchQuery]);

  if (!isOpen) return null;

  const handleSimulateRuleDispatch = (rule) => {
    const matches = runDunningDryRun(rule, buildings || [], {}, { isEn, repProfile });
    if (matches.length === 0) {
      showToast(isEn ? "No units currently match this rule condition." : "Jelenleg egyetlen lakás sem felel meg a szabály feltételeinek.", "info");
      return;
    }

    const outboxPayloads = matches.map(m => ({
      ruleId: rule.id,
      ruleName: isEn ? (rule.nameEn || rule.name) : rule.name,
      buildingId: m.buildingId,
      buildingName: m.buildingName,
      flatNum: m.flatNum,
      recipientName: m.ownerName,
      recipientEmail: m.ownerEmail || (isEn ? "No email provided" : "Nincs e-mail"),
      subject: m.renderedSubject,
      body: m.renderedBody,
      debt: m.balance,
      arrearsMonths: m.arrearsMonths,
      status: 'simulated'
    }));

    queueOutboxItems(outboxPayloads);
    showToast(isEn 
      ? `Simulated & queued ${matches.length} notices in the Outbox!` 
      : `${matches.length} db értesítő sikeresen bejegyezve a Kiküldési naplóba!`, "info");
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-20 w-full shadow-xs bg-white border-b border-gray-200">
        <ImpersonationBanner onExit={onClose} />
        <div className="px-3 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3">
          {/* Left: Logo & Back */}
          <div className="flex items-center gap-3 min-w-0">
            <NavLogoButton onClick={onClose} />
            <div className="hidden sm:block h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
                  {t.comm_center_title || (isEn ? "Communication & Email Center" : "Kommunikációs & E-mail Központ")}
                </h1>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {isEn ? "Automated dunning rules, email templates & notifications" : "Automatikus felszólítási szabályok, sablonok és értesítések"}
                </span>
              </div>
            </div>
          </div>

          {/* Center / Right: Building Filter Dropdown & Close */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="bg-transparent text-gray-800 text-xs font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">{isEn ? "🌐 All Buildings" : "🌐 Minden társasház"}</option>
                {(buildings || []).map(b => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.officialName || b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              title={isEn ? "Close" : "Bezárás"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="px-3 sm:px-6 md:px-8 py-2 bg-gray-50/70 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-gray-200 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'inbox'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{t.comm_tab_inbox || (isEn ? "Inbox & Alerts" : "Értesítések & Üzenetek")}</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rules'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{t.comm_tab_rules || (isEn ? "Dunning Rules Engine" : "Felszólítási Szabályok")}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[#1E3A8A] text-[10px] font-extrabold">
                {activeRules.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outbox')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'outbox'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{t.comm_tab_outbox || (isEn ? "Outbox & Delivery Logs" : "Kiküldési Napló")}</span>
              {(emailOutbox || []).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700 text-[10px] font-extrabold">
                  {emailOutbox.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box & Tab Action */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial max-w-md ml-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? "Search..." : "Keresés..."}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'rules' && (
              <button
                type="button"
                onClick={() => {
                  setEditingRule(null);
                  setIsEditRuleOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex-shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEn ? "New Rule" : "Új szabály"}</span>
              </button>
            )}

            {activeTab === 'inbox' && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex-shrink-0 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{isEn ? "Mark all read" : "Mind olvasott"}</span>
              </button>
            )}

            {activeTab === 'outbox' && (emailOutbox || []).length > 0 && (
              <button
                type="button"
                onClick={clearOutboxItems}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex-shrink-0 cursor-pointer"
                title={isEn ? "Clear simulated outbox" : "Napló kiürítése"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isEn ? "Clear" : "Ürítés"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* TAB 1: INBOX & NOTIFICATIONS */}
          {activeTab === 'inbox' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden animate-fadeIn">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <Mail className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-500">
                    {t.notif_empty || (isEn ? "No notifications or system messages found." : "Nincs új értesítés vagy rendszerüzenet.")}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isCritical = notif.severity === 'critical';
                  const title = isEn ? (notif.titleEn || notif.titleHu) : (notif.titleHu || notif.titleEn);
                  const message = isEn ? (notif.messageEn || notif.messageHu) : (notif.messageHu || notif.messageEn);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) markNotificationRead(notif.id);
                      }}
                      className={`p-4 transition-colors cursor-pointer relative group border-l-4 flex items-start justify-between gap-4 ${
                        isCritical
                          ? notif.read
                            ? 'bg-red-50/50 hover:bg-red-50/70 border-l-red-400'
                            : 'bg-red-50/90 hover:bg-red-100/70 border-l-red-500'
                          : notif.read
                          ? 'bg-white hover:bg-gray-50/80 border-l-transparent'
                          : 'bg-blue-50/40 hover:bg-blue-50/70 border-l-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs ${
                            isCritical
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-[#1E3A8A]'
                          }`}
                        >
                          {isCritical ? <ShieldAlert className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-gray-900 font-display">
                              {title}
                            </span>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                            )}
                            {notif.buildingName && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                                {notif.buildingName}
                              </span>
                            )}
                          </div>

                          <p className={`text-xs leading-relaxed ${isCritical ? 'text-red-950 font-medium' : 'text-gray-600'}`}>
                            {message}
                          </p>

                          {/* Bank account change breakdown */}
                          {Array.isArray(notif.changes) && notif.changes.length > 0 && (
                            <div className="mt-2 space-y-1 bg-white/80 border border-red-200 rounded-xl p-2.5">
                              {notif.changes.map((ch, idx) => (
                                <div key={idx} className="text-xs font-mono text-red-950 break-all">
                                  <span className="font-sans font-bold text-red-800">
                                    {isEn ? ch.accountLabelEn : ch.accountLabelHu}:
                                  </span>{' '}
                                  <span className="line-through text-red-500">{ch.oldAccount}</span>{' '}
                                  →{' '}
                                  <span className="font-bold text-red-900">{ch.newAccount}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(notif.createdAt, isEn)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(notif.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-black/5 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title={isEn ? "Dismiss" : "Elrejtés"}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: AUTOMATED DUNNING & NOTIFICATION RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fadeIn">
              {filteredRules.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 space-y-3">
                  <Settings2 className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">
                    {isEn ? "No automated notification rules configured." : "Nincs beállított automatikus felszólítási szabály."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRule(null);
                      setIsEditRuleOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isEn ? "Create First Rule" : "Első szabály létrehozása"}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredRules.map((rule) => {
                    const ruleName = isEn ? (rule.nameEn || rule.name) : rule.name;
                    const ruleDesc = isEn ? (rule.descriptionEn || rule.description) : rule.description;
                    const bObj = rule.buildingId === 'all' 
                      ? null 
                      : (buildings || []).find(b => b.id === rule.buildingId);

                    return (
                      <div
                        key={rule.id}
                        className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between gap-4 ${
                          rule.enabled ? 'border-gray-200 hover:border-blue-300' : 'border-gray-200/70 bg-gray-50/50 opacity-80'
                        }`}
                      >
                        {/* Top: Title, Toggle & Target */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display">
                                {ruleName}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                {rule.enabled ? (isEn ? "ACTIVE" : "AKTÍV") : (isEn ? "PAUSED" : "KIKAPCSOLVA")}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] text-[10px] font-bold border border-blue-200">
                                🏢 {rule.buildingId === 'all' ? (isEn ? "All Buildings" : "Minden ház") : (bObj?.officialName || bObj?.name || 'Társasház')}
                              </span>
                            </div>
                            {ruleDesc && (
                              <p className="text-xs text-gray-500">
                                {ruleDesc}
                              </p>
                            )}
                          </div>

                          {/* Toggle Switch */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleEmailRule(rule.id)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                                rule.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                              }`}
                              title={rule.enabled ? (isEn ? "Click to pause" : "Kattints a szüneteltetéshez") : (isEn ? "Click to activate" : "Kattints az aktiváláshoz")}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  rule.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Middle: Formula & Schedule Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
                          <span className="px-2.5 py-1 rounded-xl bg-gray-100 text-gray-700 font-semibold flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-gray-500" />
                            <span>
                              {rule.conditionType === 'months' && `${isEn ? "Arrears" : "Hátralék"} ≥ ${rule.monthThreshold} ${isEn ? "months" : "hó"}`}
                              {rule.conditionType === 'amount' && `${isEn ? "Arrears" : "Hátralék"} ≥ ${formatCurrency(rule.minAmountHuf)}`}
                              {rule.conditionType === 'combined' && `≥ ${rule.monthThreshold} hó ${rule.operator} ≥ ${formatCurrency(rule.minAmountHuf)}`}
                            </span>
                          </span>

                          <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 font-semibold flex items-center gap-1.5 border border-purple-100">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            <span>{isEn ? `Day ${rule.checkDayOfMonth || 15} of month` : `Minden hó ${rule.checkDayOfMonth || 15}. napján`}</span>
                          </span>

                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 font-semibold flex items-center gap-1.5 border border-amber-100">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{isEn ? `${rule.cooldownDays || 25}d cooldown` : `${rule.cooldownDays || 25} nap türelem`}</span>
                          </span>
                        </div>

                        {/* Bottom Action Buttons */}
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setRuleDryRunTarget(rule)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              title={isEn ? "Simulate rule against live unit balances" : "Szabály kiértékelése és élő levél előnézet"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isEn ? "Dry Run / Preview" : "Száraz teszt / Előnézet"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSimulateRuleDispatch(rule)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              title={isEn ? "Generate and queue notices to Outbox log" : "Felszólítások bejegyzése a kiküldési naplóba"}
                            >
                              <Play className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{isEn ? "Queue to Outbox" : "Naplóba küldés"}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRule(rule);
                                setIsEditRuleOpen(true);
                              }}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                              title={isEn ? "Edit Rule" : "Szabály szerkesztése"}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(isEn ? "Are you sure you want to delete this rule?" : "Biztosan törlöd ezt a szabályt?")) {
                                  deleteEmailRule(rule.id);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title={isEn ? "Delete Rule" : "Szabály törlése"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OUTBOX & DELIVERY LOGS */}
          {activeTab === 'outbox' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden animate-fadeIn">
              {outboxItems.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <History className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">
                    {isEn ? "No emails or dunning letters logged in Outbox yet." : "A kiküldési napló jelenleg üres."}
                  </p>
                  <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                    {isEn 
                      ? "When rules trigger or you click 'Queue to Outbox', generated letters will be logged here with recipient status and preview."
                      : "Amikor a szabályok lefutnak, vagy a 'Naplóba küldés' gombra kattintasz, a legenerált levelek itt kerülnek naplózásra megtekinthető formában."}
                  </p>
                </div>
              ) : (
                outboxItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setViewingLetter(item)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 truncate">
                          {item.subject}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
                          {item.ruleName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          {item.status === 'simulated' ? (isEn ? "Simulated / Logged" : "Szimulálva / Naplózva") : item.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                        <span>🏢 {item.buildingName} • {item.flatNum}. lakás</span>
                        <span>&bull;</span>
                        <span>👤 {item.recipientName} ({item.recipientEmail})</span>
                        <span>&bull;</span>
                        <span className="text-red-600 font-bold">{formatCurrency(item.debt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right text-[11px] text-gray-400">
                        {formatTime(item.queuedAt, isEn)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingLetter(item);
                        }}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-700 flex items-center gap-1 text-[11px] font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isEn ? "View Letter" : "Megtekintés"}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* SUBMODAL 1: Edit Rule */}
      {isEditRuleOpen && (
        <EditEmailRuleModal
          isOpen={isEditRuleOpen}
          rule={editingRule}
          defaultBuildingId={selectedBuildingId}
          onClose={() => setIsEditRuleOpen(false)}
          onSave={saveEmailRule}
        />
      )}

      {/* SUBMODAL 2: View Letter Content Modal */}
      {viewingLetter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#1E3A8A]" />
                <h3 className="text-sm font-bold text-gray-900 font-display">
                  {isEn ? "Logged Email Notice" : "Naplózott Felszólító Levél"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingLetter(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="border-b border-gray-100 pb-2">
                <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{isEn ? "Subject" : "Tárgy"}</span>
                <span className="font-bold text-gray-900 text-sm">{viewingLetter.subject}</span>
              </div>
              <div className="border-b border-gray-100 pb-2 flex items-center justify-between text-gray-600">
                <span>{isEn ? "To:" : "Címzett:"} <strong>{viewingLetter.recipientName} ({viewingLetter.recipientEmail})</strong></span>
                <span>{isEn ? "Flat:" : "Albetét:"} <strong>{viewingLetter.flatNum}. {isEn ? "flat" : "lakás"}</strong></span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider mb-1">{isEn ? "Letter Body" : "Levél szövege"}</span>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 font-mono text-xs whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {viewingLetter.body}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingLetter(null)}
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold"
              >
                {isEn ? "Close" : "Bezárás"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 3: Standalone Dry Run Viewer */}
      {ruleDryRunTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-[#1E3A8A]" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 font-display">
                    {isEn ? "Rule Dry Run Evaluation:" : "Szabály kiértékelés (Száraz teszt):"} {isEn ? (ruleDryRunTarget.nameEn || ruleDryRunTarget.name) : ruleDryRunTarget.name}
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    {isEn ? "Currently matching units based on actual recorded balances" : "Jelenlegi könyvelt egyenlegek alapján érintett lakások"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRuleDryRunTarget(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {(() => {
                const matches = runDunningDryRun(ruleDryRunTarget, buildings || [], {}, { isEn, repProfile });
                if (matches.length === 0) {
                  return (
                    <div className="py-12 text-center text-gray-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                      <p className="font-semibold text-gray-600">
                        {isEn ? "Zero units currently exceed this debt threshold!" : "Egyetlen lakás sem lépi át ezt a tartozási küszöböt!"}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-bold text-gray-700">{isEn ? "Matching Recipients:" : "Érintett lakók és tartozások:"} ({matches.length})</span>
                    </div>
                    {matches.map((m) => (
                      <div key={`${m.buildingId}-${m.flatNum}`} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-gray-900">{m.ownerName} ({m.flatNum}. lakás)</div>
                          <div className="text-[11px] text-gray-500">🏢 {m.buildingName} • E-mail: {m.ownerEmail || (isEn ? "None" : "Nincs megadva")}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600 font-display">{formatCurrency(m.balance)}</div>
                          <div className="text-[10px] text-amber-700 font-bold">{m.arrearsMonths} {isEn ? "months debt" : "havi elmaradás"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRuleDryRunTarget(null)}
                className="px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-xl text-xs font-bold"
              >
                {isEn ? "Close" : "Bezárás"}
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSimulateRuleDispatch(ruleDryRunTarget);
                  setRuleDryRunTarget(null);
                  setActiveTab('outbox');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isEn ? "Queue All to Outbox" : "Mind bejegyzése a naplóba"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
