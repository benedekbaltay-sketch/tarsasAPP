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
  ArrowRight,
  ArrowLeft,
  ArrowUpRight, 
  CheckCircle2, 
  FileText,
  Play,
  Calendar,
  Users,
  CheckSquare,
  Square,
  AlertCircle
} from 'lucide-react';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { EditEmailRuleModal } from './EditEmailRuleModal';
import { 
  DEFAULT_DUNNING_RULES, 
  runDunningDryRun,
  resolveFlatOwnerName
} from '../../utils/dunningRules.js';
import { formatCurrency } from '../../utils/finances.js';
import { 
  getNotificationsForUser, 
  getAccessibleBuildings, 
  resolveUserOrgContext,
  isUserBuildingViewer,
  canUserManageBuilding
} from '../../utils/teamPermissions.js';

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
    sendCustomResidentNotice,
    showToast
  } = useApp();

  const { currentUser, currentLang, buildings, notifications, emailRules, emailOutbox, repProfile } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || state.roleMode === 'admin';

  const orgCtx = useMemo(() => {
    return resolveUserOrgContext(currentUser, state.organizations || [], buildings || []);
  }, [currentUser, state.organizations, buildings]);

  const accessibleBuildings = useMemo(() => {
    return getAccessibleBuildings(currentUser, buildings || [], state.organizations || []);
  }, [currentUser, buildings, state.organizations]);

  // Tabs: strictly 'inbox' | 'rules' | 'outbox'
  const [activeTab, setActiveTab] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [isEditRuleOpen, setIsEditRuleOpen] = useState(false);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [ruleDryRunTarget, setRuleDryRunTarget] = useState(null);

  // Compose Modal State: 2-step flow (1: Audience & Channels, 2: Compose & Tags)
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeStep, setComposeStep] = useState(1);
  const [composeTargetBuildingId, setComposeTargetBuildingId] = useState(() => {
    if (initialBuildingId && initialBuildingId !== 'all') return initialBuildingId;
    return 'all';
  });
  const [composeAudience, setComposeAudience] = useState('all'); // 'all' | 'arrears' | 'szvb' | 'custom'
  const [composeIncludeTenants, setComposeIncludeTenants] = useState(false);
  const [composeCustomFlats, setComposeCustomFlats] = useState([]); // array of 'buildingId:flatNum'
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSendEmail, setComposeSendEmail] = useState(true);
  const [composeSendInApp, setComposeSendInApp] = useState(true);
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Permission evaluation across accessible buildings
  const canManageAnyBuilding = useMemo(() => {
    if (orgCtx.isOwner || orgCtx.isSuperAdmin) return true;
    return accessibleBuildings.some(b =>
      canUserManageBuilding(currentUser, b.id, state.organizations || [], buildings || [])
    );
  }, [orgCtx, accessibleBuildings, currentUser, state.organizations, buildings]);

  // Target buildings for composing (single building or all managed buildings)
  const composeTargetBuildings = useMemo(() => {
    if (composeTargetBuildingId === 'all') {
      return accessibleBuildings.filter(b =>
        canUserManageBuilding(currentUser, b.id, state.organizations || [], buildings || [])
      );
    }
    const single = (buildings || []).find(b => b.id === composeTargetBuildingId);
    return single ? [single] : [];
  }, [composeTargetBuildingId, accessibleBuildings, currentUser, state.organizations, buildings]);

  const canManageCurrentComposeTarget = useMemo(() => {
    if (composeTargetBuildingId === 'all') {
      return composeTargetBuildings.length > 0;
    }
    return canUserManageBuilding(currentUser, composeTargetBuildingId, state.organizations || [], buildings || []);
  }, [composeTargetBuildingId, composeTargetBuildings, currentUser, state.organizations, buildings]);

  // Calculate target audience recipients for compose
  const resolvedRecipients = useMemo(() => {
    if (!composeTargetBuildings || composeTargetBuildings.length === 0) return [];
    const recList = [];

    composeTargetBuildings.forEach(b => {
      const flats = Array.isArray(b.flats) ? b.flats : [];
      let targetFlats = flats;
      if (composeAudience === 'arrears') {
        targetFlats = flats.filter(f => {
          const bal = (Number(f.balance) || 0) + (Number(f.renovationBalance) || 0);
          return bal < 0;
        });
      } else if (composeAudience === 'szvb') {
        targetFlats = flats.filter(f => Boolean(f.isBoardMember || f.szvbMember));
      } else if (composeAudience === 'custom') {
        targetFlats = flats.filter(f => composeCustomFlats.includes(`${b.id}:${f.flatNum}`));
      }

      targetFlats.forEach(flat => {
        const pEmail = (flat.email || '').trim();
        const pName = resolveFlatOwnerName(flat, isEn);
        const debt = (Number(flat.balance) || 0) + (Number(flat.renovationBalance) || 0);

        recList.push({
          buildingId: b.id,
          buildingName: b.officialName || b.name,
          flatNum: flat.flatNum,
          name: pName,
          email: pEmail,
          isOwner: true,
          isTenant: false,
          balance: debt,
          balanceFormatted: formatCurrency(debt)
        });

        if (Array.isArray(flat.owners)) {
          flat.owners.forEach(o => {
            const oEmail = (o.email || '').trim();
            const oName = (o.name || '').trim();
            if (oEmail && oEmail.toLowerCase() !== pEmail.toLowerCase()) {
              recList.push({
                buildingId: b.id,
                buildingName: b.officialName || b.name,
                flatNum: flat.flatNum,
                name: oName || pName,
                email: oEmail,
                isOwner: true,
                isTenant: false,
                balance: debt,
                balanceFormatted: formatCurrency(debt)
              });
            }
          });
        }

        if (composeIncludeTenants && Array.isArray(flat.tenants)) {
          flat.tenants.forEach(t => {
            const tEmail = (t.email || '').trim();
            const tName = (t.name || '').trim();
            if (tEmail) {
              recList.push({
                buildingId: b.id,
                buildingName: b.officialName || b.name,
                flatNum: flat.flatNum,
                name: tName || (isEn ? `Tenant (${flat.flatNum})` : `Bérlő (${flat.flatNum})`),
                email: tEmail,
                isOwner: false,
                isTenant: true,
                balance: debt,
                balanceFormatted: formatCurrency(debt)
              });
            }
          });
        }
      });
    });

    return recList;
  }, [composeTargetBuildings, composeAudience, composeCustomFlats, composeIncludeTenants, isEn]);

  const recipientStats = useMemo(() => {
    const withEmail = resolvedRecipients.filter(r => Boolean(r.email));
    const withoutEmail = resolvedRecipients.filter(r => !r.email);
    const uniqueFlats = new Set(resolvedRecipients.map(r => `${r.buildingId}:${r.flatNum}`));
    return {
      total: resolvedRecipients.length,
      withEmail: withEmail.length,
      withoutEmail: withoutEmail.length,
      uniqueFlatsCount: uniqueFlats.size
    };
  }, [resolvedRecipients]);

  // Fallback to default dunning rules if not initialized
  const activeRules = useMemo(() => {
    return Array.isArray(emailRules)
      ? emailRules
      : DEFAULT_DUNNING_RULES;
  }, [emailRules]);

  // Notifications belonging to current user profile (without building restriction)
  const userNotifications = useMemo(() => {
    return getNotificationsForUser(notifications || [], currentUser);
  }, [notifications, currentUser]);

  const filteredNotifications = useMemo(() => {
    return userNotifications.filter(n => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = (isEn ? (n.titleEn || n.titleHu) : (n.titleHu || n.titleEn)) || '';
      const msg = (isEn ? (n.messageEn || n.messageHu) : (n.messageHu || n.messageEn)) || '';
      const bldName = n.buildingName || '';
      return title.toLowerCase().includes(q) || msg.toLowerCase().includes(q) || bldName.toLowerCase().includes(q);
    });
  }, [userNotifications, searchQuery, isEn]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return activeRules.filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (isEn ? (r.nameEn || r.name) : (r.name || r.nameEn)) || '';
      const desc = (isEn ? (r.descriptionEn || r.description) : (r.description || r.descriptionEn)) || '';
      return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    });
  }, [activeRules, searchQuery, isEn]);

  // Outbox items
  const outboxItems = useMemo(() => {
    return (emailOutbox || []).filter(item => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (item.recipientName && item.recipientName.toLowerCase().includes(q)) ||
        (item.recipientEmail && item.recipientEmail.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.ruleName && item.ruleName.toLowerCase().includes(q)) ||
        (item.buildingName && item.buildingName.toLowerCase().includes(q)) ||
        (item.flatNum && item.flatNum.toString().includes(q))
      );
    });
  }, [emailOutbox, searchQuery]);

  const handleSimulateRuleDispatch = (rule) => {
    if (!canManageAnyBuilding) {
      showToast(t.comm_viewer_action_blocked || (isEn ? "Action blocked: Viewers cannot trigger notices." : "Művelet megtagadva: Megtekintők nem futtathatnak felszólításokat."), "error");
      return;
    }
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

  const handleInsertTag = (tag) => {
    setComposeBody(prev => (prev ? `${prev} ${tag}` : tag));
  };

  const handleToggleCustomFlat = (key) => {
    setComposeCustomFlats(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFlats = () => {
    const allKeys = [];
    composeTargetBuildings.forEach(b => {
      (b.flats || []).forEach(f => {
        allKeys.push(`${b.id}:${f.flatNum}`);
      });
    });
    setComposeCustomFlats(allKeys);
  };

  const handleClearFlatSelection = () => {
    setComposeCustomFlats([]);
  };

  const handleOpenCompose = () => {
    setComposeStep(1);
    setIsComposeOpen(true);
  };

  const handleSendCustomNotice = async () => {
    if (!canManageCurrentComposeTarget) {
      showToast(t.comm_viewer_action_blocked || (isEn ? "Action blocked: Viewers cannot send notices." : "Művelet megtagadva: Megtekintők nem küldhetnek leveleket."), "error");
      return;
    }
    if (composeTargetBuildings.length === 0) {
      showToast(isEn ? "No accessible target condominium selected." : "Nincs kezelhető célzott társasház kiválasztva!", "error");
      return;
    }
    if (!composeSubject.trim()) {
      showToast(t.comm_subject_required || (isEn ? "Please provide a subject." : "Kérlek add meg a levél tárgyát!"), "error");
      return;
    }
    if (!composeBody.trim()) {
      showToast(t.comm_body_required || (isEn ? "Please enter the letter text." : "Kérlek add meg a levél szövegét!"), "error");
      return;
    }
    if (!composeSendEmail && !composeSendInApp) {
      showToast(isEn ? "Select at least one delivery channel (Email or Notification)." : "Válassz legalább egy kézbesítési csatornát (E-mail vagy Értesítés)!", "error");
      return;
    }

    if (resolvedRecipients.length === 0) {
      showToast(t.comm_no_recipients || (isEn ? "No recipients match the selected criteria." : "A kiválasztott feltételeknek egyetlen címzett sem felel meg."), "error");
      return;
    }

    const bldScopeLabel = composeTargetBuildingId === 'all'
      ? (isEn ? `all ${composeTargetBuildings.length} condominiums` : `mind a(z) ${composeTargetBuildings.length} társasházban`)
      : (composeTargetBuildings[0]?.name || '');

    const confirmMsg = isEn
      ? `Send notice to ${resolvedRecipients.length} recipients (${bldScopeLabel})?`
      : `Biztosan elküldöd a levelet ${resolvedRecipients.length} címzettnek (${bldScopeLabel})?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSendingNotice(true);
    try {
      const result = await sendCustomResidentNotice({
        buildingId: composeTargetBuildingId,
        recipients: resolvedRecipients,
        category: 'general',
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        sendEmail: composeSendEmail,
        sendInAppNotification: composeSendInApp
      });

      if (result && result.success) {
        showToast(
          (t.comm_sent_toast || (isEn ? "Letter successfully sent to {count} recipient(s)!" : "Levél sikeresen kiküldve {count} címzettnek!"))
            .replace('{count}', resolvedRecipients.length),
          "success"
        );
        setComposeSubject('');
        setComposeBody('');
        setComposeCustomFlats([]);
        setComposeStep(1);
        setIsComposeOpen(false);
        setActiveTab('outbox');
      }
    } finally {
      setIsSendingNotice(false);
    }
  };

  // Safe early return strictly after all hooks
  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-20 w-full shadow-xs bg-white border-b border-gray-200">
        <ImpersonationBanner onExit={onClose} />
        <div className="px-3 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3">
          {/* Left: Logo & Title */}
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
                  {isEn ? "Profile messages, automated dunning rules & outgoing logs" : "Profil üzenetek, automatikus felszólítási szabályok és kiküldési napló"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: + Új levél írása button (replaces building switcher) & Close */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {canManageAnyBuilding ? (
              <button
                type="button"
                onClick={handleOpenCompose}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-shrink-0"
                title={isEn ? "Compose new resident notice or circular letter" : "Új lakói levél vagy körlevél írása"}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t.comm_compose_btn || (isEn ? "Compose Notice" : "Új levél írása")}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold">
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.comm_viewer_badge || (isEn ? "View-Only" : "Csak megtekintő")}</span>
              </span>
            )}

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
          {/* Tabs: strictly Inbox, Rules, Outbox */}
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

            {activeTab === 'rules' && canManageAnyBuilding && (
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

            {activeTab === 'outbox' && (emailOutbox || []).length > 0 && canManageAnyBuilding && (
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
          
          {/* TAB 1: INBOX & PROFILE NOTIFICATIONS */}
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
                                🏢 {notif.buildingName}
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
              {!canManageAnyBuilding && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-900 shadow-2xs">
                  <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <strong className="block font-bold">{t.comm_viewer_badge || (isEn ? "View-Only Permission" : "Csak megtekintési jogosultság")}</strong>
                    <span>{t.comm_viewer_banner_rules || (isEn ? "You have view-only access. Automated dunning rules cannot be edited or modified." : "Csak megtekintési jogosultságod van. A felszólítási szabályok nem módosíthatók.")}</span>
                  </div>
                </div>
              )}

              {filteredRules.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 space-y-3">
                  <Settings2 className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">
                    {isEn ? "No automated notification rules configured." : "Nincs beállított automatikus felszólítási szabály."}
                  </p>
                  {canManageAnyBuilding && (
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
                  )}
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
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                                ⏰ {t.comm_rule_schedule_chip ? t.comm_rule_schedule_chip.replace('{day}', rule.checkDayOfMonth || 15) : (isEn ? `Every month ${rule.checkDayOfMonth || 15}th – 08:00 AM` : `Minden hó ${rule.checkDayOfMonth || 15}. – 08:00`)}
                              </span>
                              {rule.lastAutoDispatchedDate && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium border border-gray-200">
                                  ✓ {t.comm_rule_last_run ? t.comm_rule_last_run.replace('{date}', rule.lastAutoDispatchedDate) : (isEn ? `Last run: ${rule.lastAutoDispatchedDate}` : `Utolsó kiküldés: ${rule.lastAutoDispatchedDate}`)}
                                </span>
                              )}
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
                              disabled={!canManageAnyBuilding}
                              onClick={() => canManageAnyBuilding && toggleEmailRule(rule.id)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                                rule.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                              } ${!canManageAnyBuilding ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                              title={!canManageAnyBuilding 
                                ? (isEn ? "View-only permission: Cannot toggle rule" : "Csak megtekintő: Szabály nem kapcsolható")
                                : (rule.enabled ? (isEn ? "Click to pause" : "Kattints a szüneteltetéshez") : (isEn ? "Click to activate" : "Kattints az aktiváláshoz"))}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                  rule.enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
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

                            {canManageAnyBuilding && (
                              <button
                                type="button"
                                onClick={() => handleSimulateRuleDispatch(rule)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                title={isEn ? "Generate and queue notices to Outbox log" : "Felszólítások bejegyzése a kiküldési naplóba"}
                              >
                                <Play className="w-3.5 h-3.5 text-emerald-700" />
                                <span>{isEn ? "Queue to Outbox" : "Naplóba küldés"}</span>
                              </button>
                            )}
                          </div>

                          {canManageAnyBuilding && (
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
                          )}
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
                      ? "When rules trigger, or circular notices are sent via '+ Compose Notice', letters will be logged here with recipient status and preview."
                      : "Amikor a szabályok lefutnak, vagy körlevelet küldesz az '+ Új levél írása' gombbal, a kiküldött levelek itt kerülnek naplózásra megtekinthető formában."}
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'sent' || item.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.status === 'failed'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {item.status === 'simulated' ? (isEn ? "Simulated / Logged" : "Szimulálva / Naplózva") : item.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                        <span>🏢 {item.buildingName} • {item.flatNum}. lakás</span>
                        <span>&bull;</span>
                        <span>👤 {item.recipientName} ({item.recipientEmail})</span>
                        {item.debt !== undefined && item.debt !== null && item.debt !== 0 && (
                          <>
                            <span>&bull;</span>
                            <span className="text-red-600 font-bold">{formatCurrency(item.debt)}</span>
                          </>
                        )}
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

      {/* SUBMODAL 1: COMPOSE NOTICE MODAL (2-STEP WIZARD) */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center flex-shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display">
                    {t.comm_compose_title || (isEn ? "Compose Resident Notice / Circular Letter" : "Hivatalos levél & Körlevél küldése")}
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    {t.comm_compose_subtitle || (isEn ? "Broadcast direct notices to residents via email and in-app notifications." : "Közvetlen tájékoztató vagy felhívás küldése a lakóknak e-mailben és a lakói felületen.")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Navigation Bar */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-100/70 border-b border-gray-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setComposeStep(1)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  composeStep === 1 
                    ? 'bg-white text-[#1E3A8A] shadow-xs' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  composeStep === 1 ? 'bg-[#1E3A8A] text-white' : 'bg-gray-300 text-gray-700'
                }`}>1</span>
                <span>{t.comm_step_recipients || (isEn ? "1. Recipients & Channels" : "1. Címzettek és csatornák")}</span>
              </button>

              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />

              <button
                type="button"
                onClick={() => {
                  if (resolvedRecipients.length > 0 && (composeSendEmail || composeSendInApp)) {
                    setComposeStep(2);
                  }
                }}
                disabled={resolvedRecipients.length === 0 || (!composeSendEmail && !composeSendInApp)}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
                  composeStep === 2 
                    ? 'bg-white text-[#1E3A8A] shadow-xs cursor-pointer' 
                    : resolvedRecipients.length > 0 && (composeSendEmail || composeSendInApp)
                    ? 'text-gray-500 hover:text-gray-900 cursor-pointer'
                    : 'text-gray-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  composeStep === 2 ? 'bg-[#1E3A8A] text-white' : 'bg-gray-300 text-gray-700'
                }`}>2</span>
                <span>{t.comm_step_compose || (isEn ? "2. Write Letter" : "2. Levél megírása")}</span>
              </button>
            </div>

            {/* STEP 1: CÍMZETTEK ÉS CSATORNÁK */}
            {composeStep === 1 && (
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1 animate-fadeIn">
                {/* Viewer restriction alert */}
                {!canManageCurrentComposeTarget && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs">
                    <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{t.comm_viewer_banner_compose || (isEn ? "You have view-only access. Composing notices is disabled." : "Csak megtekintési jogosultságod van. Levélküldéshez kezelői jog szükséges.")}</span>
                  </div>
                )}

                {/* 1. Target Condominium (Single building or ALL buildings broadcast) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {isEn ? "Target Condominium" : "Célzott társasház"}
                  </label>
                  <select
                    value={composeTargetBuildingId}
                    onChange={(e) => {
                      setComposeTargetBuildingId(e.target.value);
                      setComposeCustomFlats([]);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A]"
                  >
                    <option value="all">
                      {t.comm_target_all_buildings || (isEn ? "🌐 All Managed Buildings (Broadcast to all)" : "🌐 Minden kezelt társasház (Körlevél mindenhova)")}
                    </option>
                    {accessibleBuildings.map(b => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.officialName || b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Target Audience Presets */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700">
                      {t.comm_target_audience || (isEn ? "Target Audience / Preset" : "Címzetti kör kiválasztása")}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRecipientList(!showRecipientList)}
                      className="text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      <span>
                        {showRecipientList 
                          ? (isEn ? "Hide Recipient List" : "Címzettek elrejtése") 
                          : (isEn ? `Show ${resolvedRecipients.length} Recipients` : `${resolvedRecipients.length} címzett megtekintése`)}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setComposeAudience('all')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        composeAudience === 'all'
                          ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{t.comm_target_all || (isEn ? "All Residents" : "Minden lakó")}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 line-clamp-1">
                        {isEn ? "All registered flats" : "Minden albetét"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setComposeAudience('arrears')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        composeAudience === 'arrears'
                          ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{t.comm_target_arrears || (isEn ? "Arrears Only" : "Csak hátralékosok")}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 line-clamp-1">
                        {isEn ? "Negative balance only" : "Tartozással rendelkezők"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setComposeAudience('szvb')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        composeAudience === 'szvb'
                          ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.comm_target_szvb || (isEn ? "Audit Board" : "Csak SZVB")}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 line-clamp-1">
                        {isEn ? "Board members & audit" : "Felügyelő bizottsági tagok"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setComposeAudience('custom')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        composeAudience === 'custom'
                          ? 'border-[#1E3A8A] bg-blue-50/70 text-[#1E3A8A] shadow-xs'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                        <span>{t.comm_target_custom || (isEn ? "Custom Selection" : "Egyéni albetétek")}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 line-clamp-1">
                        {isEn ? `${composeCustomFlats.length} flats chosen` : `${composeCustomFlats.length} lakás kiválasztva`}
                      </span>
                    </button>
                  </div>

                  {/* Active Tenants Checkbox & Stats */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={composeIncludeTenants}
                        onChange={(e) => setComposeIncludeTenants(e.target.checked)}
                        className="rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A] w-4 h-4 cursor-pointer"
                      />
                      <span>{t.comm_include_tenants || (isEn ? "Include registered active tenants" : "Bejegyzett aktív bérlők bevonása a címzettek közé")}</span>
                    </label>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-bold">
                        {recipientStats.uniqueFlatsCount} {isEn ? "flats" : "albetét"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] font-bold border border-blue-200">
                        {recipientStats.total} {isEn ? "recipients" : "címzett"}
                      </span>
                      {recipientStats.withoutEmail > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>{recipientStats.withoutEmail} {isEn ? "in-app only" : "csak belső értesítés"}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Custom Flat Multi-Select */}
                  {composeAudience === 'custom' && (
                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-700">
                          {isEn ? "Select Target Flats:" : "Válaszd ki az érintett lakásokat:"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFlats}
                            className="text-[11px] font-bold text-blue-700 hover:underline"
                          >
                            {isEn ? "Select All" : "Mind kijelölése"}
                          </button>
                          <span>&bull;</span>
                          <button
                            type="button"
                            onClick={handleClearFlatSelection}
                            className="text-[11px] font-bold text-gray-500 hover:underline"
                          >
                            {isEn ? "Clear" : "Kijelölés törlése"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {composeTargetBuildings.flatMap(b => (b.flats || []).map(flat => {
                          const key = `${b.id}:${flat.flatNum}`;
                          const isSelected = composeCustomFlats.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleToggleCustomFlat(key)}
                              className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                                isSelected
                                  ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] font-bold'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 font-medium'
                              }`}
                            >
                              <span className="truncate">
                                {composeTargetBuildingId === 'all' ? `[${b.name.slice(0, 10)}] ` : ''}
                                {flat.flatNum}. {flat.ownerName || 'Lakó'}
                              </span>
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" /> : <Square className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />}
                            </button>
                          );
                        }))}
                      </div>
                    </div>
                  )}

                  {/* Expanded Recipient List Inspection */}
                  {showRecipientList && (
                    <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-2 max-h-56 overflow-y-auto">
                      <div className="text-xs font-bold text-gray-800 flex items-center justify-between">
                        <span>{isEn ? "Calculated Recipient List" : "Kiszámított címzettek listája"} ({resolvedRecipients.length})</span>
                      </div>
                      <div className="divide-y divide-blue-100 text-xs">
                        {resolvedRecipients.map((r, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                            <span className="font-semibold text-gray-900 truncate">
                              🏢 {r.buildingName} • {r.flatNum}. lakás: {r.name} {r.isTenant ? `(${isEn ? 'Tenant' : 'Bérlő'})` : ''}
                            </span>
                            <span className="font-mono text-[11px] text-gray-600 truncate">
                              {r.email || <span className="text-amber-700 italic">{isEn ? "No email" : "Nincs e-mail"}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Delivery Channels */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <label className="block text-xs font-bold text-gray-700">
                    {isEn ? "Delivery Channels:" : "Kézbesítési csatornák:"}
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={composeSendEmail}
                        onChange={(e) => setComposeSendEmail(e.target.checked)}
                        className="rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A] w-4 h-4 cursor-pointer"
                      />
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t.comm_channel_email || (isEn ? "Resend Transactional Email" : "E-mail küldése a lakók postaládájába")}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={composeSendInApp}
                        onChange={(e) => setComposeSendInApp(e.target.checked)}
                        className="rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A] w-4 h-4 cursor-pointer"
                      />
                      <Bell className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t.comm_channel_portal || (isEn ? "In-App Notification Bell" : "Belső rendszerértesítés megjelenítése a portálon")}</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: LEVÉL MEGÍRÁSA ÉS DINAMIKUS MEZŐK */}
            {composeStep === 2 && (
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1 animate-fadeIn">
                {/* Summary header recap */}
                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#1E3A8A]" />
                    <span className="font-semibold">
                      {composeTargetBuildingId === 'all' 
                        ? (isEn ? "🌐 All Managed Buildings" : "🌐 Minden kezelt társasház") 
                        : (composeTargetBuildings[0]?.name || 'Társasház')}: 
                      <strong className="ml-1 text-black font-bold">{resolvedRecipients.length} {t.comm_recipients_count || (isEn ? "recipients" : "címzett")}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                    {composeSendEmail && <span className="bg-white px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1 text-blue-800"><Mail className="w-3 h-3 text-blue-600" /> E-mail</span>}
                    {composeSendInApp && <span className="bg-white px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1 text-emerald-800"><Bell className="w-3 h-3 text-emerald-600" /> Harang</span>}
                  </div>
                </div>

                {/* Prominent Dynamic Tags Box */}
                <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E3A8A] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>{t.comm_dynamic_tags_title || (isEn ? "Insert Dynamic Tags" : "Beilleszthető dinamikus mezők")}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {t.comm_dynamic_tags_desc || (isEn ? "Click any tag to insert it into the message body. When sent, each recipient will receive their personalized unit values:" : "Kattints bármelyik változóra a levélbe illesztéshez. Kiküldéskor minden lakó a saját albetétjének adatait kapja meg:")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[
                      { tag: '{lakasTulajdonosa}', label: isEn ? "Flat Owner" : "A lakás tulajdonosa", icon: "👤" },
                      { tag: '{lakasszam}', label: isEn ? "Flat #" : "Lakásszám", icon: "🚪" },
                      { tag: '{tarsashazNeve}', label: isEn ? "Building Name" : "Társasház neve", icon: "🏢" },
                      { tag: '{egyenleg}', label: isEn ? "Current Balance" : "Aktuális egyenleg", icon: "💰" },
                      { tag: '{fizetesiAdatok}', label: isEn ? "Payment Details" : "Fizetési adatok", icon: "🏦" },
                      { tag: '{fizetesiHatarido}', label: isEn ? "Due Date (+8d)" : "Fizetési határidő", icon: "📅" },
                      { tag: '{kepviseloNeve}', label: isEn ? "Manager Name" : "Képviselő neve (személy)", icon: "✍️" },
                      { tag: '{cegNeve}', label: isEn ? "Company Name" : "Cégnév / Vállalkozás", icon: "🏛️" }
                    ].map(item => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleInsertTag(item.tag)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#1E3A8A] hover:text-white text-[#1E3A8A] text-xs font-mono font-bold border border-blue-200 shadow-2xs cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
                        title={`${item.label} (${item.tag})`}
                      >
                        <span>{item.icon}</span>
                        <span>+{item.tag}</span>
                        <span className="text-[10px] font-sans opacity-70 font-normal">({item.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {t.comm_msg_subject || (isEn ? "Subject" : "Levél tárgya")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder={isEn ? "e.g. Important notice regarding annual inspection" : "pl. Fontos tájékoztató az éves ellenőrzésről"}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] font-semibold"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {t.comm_msg_body || (isEn ? "Message Body" : "Levél szövege")} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={8}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={isEn 
                      ? "Dear {lakasTulajdonosa},\n\nPlease be informed that your current balance is {egyenleg}.\n\n{fizetesiAdatok}\nDue date: {fizetesiHatarido}" 
                      : "Tisztelt {lakasTulajdonosa}!\n\nEzúton tájékoztatjuk a {lakasszam}. lakás egyenlegéről: {egyenleg}.\n\n{fizetesiAdatok}\nFizetési határidő: {fizetesiHatarido}"}
                    className="w-full p-3.5 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] leading-relaxed resize-y"
                  />
                </div>

                {/* Preview toggle & card */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>{showLivePreview ? (isEn ? "Hide Preview" : "Előnézet elrejtése") : (isEn ? "Live Preview" : "Élő előnézet megtekintése")}</span>
                  </button>

                  {showLivePreview && (
                    <div className="mt-2 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 animate-fadeIn">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        {isEn ? "Live Sample Preview (with mock recipient data)" : "Élő mintanézet (minta adatokkal behelyettesítve)"}
                      </span>
                      <div className="font-bold text-gray-900 text-sm">
                        {composeSubject || (isEn ? "(Empty Subject)" : "(Üres tárgy)")}
                      </div>
                      <div className="text-xs font-mono text-gray-700 whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-gray-200">
                        {(composeBody || '')
                          .replace(/\{lakasTulajdonosa\}|\{flatOwner\}|\{tulajdonosNeve\}|\{ownerName\}|\{\{\s*lakas_tulajdonosa\s*\}\}|\{\{\s*flat_owner\s*\}\}|\{\{\s*tulajdonos_neve\s*\}\}|\{\{\s*owner_name\s*\}\}/gi, resolvedRecipients[0]?.name || "Minta János")
                          .replace(/\{lakasszam\}|\{flatNum\}/g, resolvedRecipients[0]?.flatNum || "12")
                          .replace(/\{tarsashazNeve\}|\{buildingName\}/g, resolvedRecipients[0]?.buildingName || composeTargetBuildings[0]?.name || "Minta Társasház")
                          .replace(/\{egyenleg\}|\{balance\}/g, formatCurrency(resolvedRecipients[0]?.balance || -25000))
                          .replace(/\{fizetesiAdatok\}|\{paymentDetails\}/g, isEn 
                            ? "Bank Transfer Details for Settlement:\n• Common Cost: 25,000 Ft\n  Beneficiary: Sunflower Condominium\n  Bank Account: 11705008-20456789-00000000\n  Reference: Flat #12 Common Cost" 
                            : "Átutalási adatok az elmaradás rendezéséhez:\n• Közös költség tartozás: 25 000 Ft\n  Kedvezményezett: Napfény Társasház\n  Bankszámlaszám: 11705008-20456789-00000000\n  Közlemény: 12. lakás közös költség")
                          .replace(/\{fizetesiHatarido\}|\{dueDate\}/g, new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toLocaleDateString(isEn ? 'en-GB' : 'hu-HU'))
                          .replace(/\{kepviseloNeve\}|\{managerName\}/g, state?.repProfile?.name || state?.currentUser?.name || (isEn ? "John Smith" : "Kovács Béla"))
                          .replace(/\{cegNeve\}|\{companyName\}/g, state?.repProfile?.companyName || (isEn ? "Sunflower Management LLC" : "Napfény Képviselet Kft."))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              {composeStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(false)}
                    className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isEn ? "Cancel" : "Mégse"}
                  </button>

                  <button
                    type="button"
                    disabled={resolvedRecipients.length === 0 || (!composeSendEmail && !composeSendInApp)}
                    onClick={() => {
                      if (resolvedRecipients.length === 0) {
                        showToast(isEn ? "No recipients match the selected criteria." : "A kiválasztott feltételeknek egyetlen címzett sem felel meg.", "warning");
                        return;
                      }
                      if (!composeSendEmail && !composeSendInApp) {
                        showToast(isEn ? "Select at least one delivery channel." : "Válassz legalább egy kézbesítési csatornát!", "warning");
                        return;
                      }
                      setComposeStep(2);
                    }}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                      resolvedRecipients.length === 0 || (!composeSendEmail && !composeSendInApp)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    <span>{t.comm_btn_next || (isEn ? "Continue to Write Letter →" : "Tovább a levél megírásához →")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setComposeStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t.comm_btn_back || (isEn ? "← Back to Recipients" : "← Vissza a címzettekhez")}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canManageCurrentComposeTarget || isSendingNotice || resolvedRecipients.length === 0 || !composeSubject.trim() || !composeBody.trim()}
                    onClick={handleSendCustomNotice}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                      !canManageCurrentComposeTarget || resolvedRecipients.length === 0 || !composeSubject.trim() || !composeBody.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : isSendingNotice
                        ? 'bg-[#1E3A8A] text-white opacity-80 cursor-wait'
                        : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSendingNotice
                        ? (t.comm_sending || (isEn ? "Sending notices..." : "Levél küldése folyamatban..."))
                        : (t.comm_send_action || (isEn ? "Send Notice" : "Levél kiküldése"))}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 2: Edit Rule */}
      {isEditRuleOpen && (
        <EditEmailRuleModal
          isOpen={isEditRuleOpen}
          rule={editingRule}
          defaultBuildingId="all"
          onClose={() => setIsEditRuleOpen(false)}
          onSave={saveEmailRule}
        />
      )}

      {/* SUBMODAL 3: View Letter Content Modal */}
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
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
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
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isEn ? "Close" : "Bezárás"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 4: Standalone Dry Run Viewer */}
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
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
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
                className="px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                {isEn ? "Close" : "Bezárás"}
              </button>

              {canManageAnyBuilding && (
                <button
                  type="button"
                  onClick={() => {
                    handleSimulateRuleDispatch(ruleDryRunTarget);
                    setRuleDryRunTarget(null);
                    setActiveTab('outbox');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isEn ? "Queue All to Outbox" : "Mind bejegyzése a naplóba"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
