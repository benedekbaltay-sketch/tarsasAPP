import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Menu,
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
  AlertCircle,
  Archive,
  ArchiveRestore,
  Paperclip,
  Download,
  Reply,
  ClipboardCheck,
  Shield,
  Loader2
} from 'lucide-react';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { EditEmailRuleModal } from './EditEmailRuleModal';
import { 
  DEFAULT_DUNNING_RULES, 
  runDunningDryRun,
  resolveFlatOwnerName,
  resolveFlatOwnerRecipients
} from '../../utils/dunningRules.js';
import { formatCurrency } from '../../utils/finances.js';
import { 
  getAccessibleBuildings, 
  resolveUserOrgContext,
  canUserManageBuilding,
  normalizeEmail
} from '../../utils/teamPermissions.js';
import {
  resolveUserProfiles,
  getNotificationsForActiveProfile,
  getSentMessagesForActiveProfile,
  getArchivedNotificationsForActiveProfile,
} from '../../utils/userProfiles.js';
import {
  resolveBuildingAuditorRecipient,
  resolveBuildingSzvbRecipients,
  resolveResidentProfileEmail,
  getConversationThreadMessages,
  groupNotificationsByThread,
} from '../../utils/directMessaging.js';
import {
  validateUploadFile,
  getFileValidationErrorMessage,
  readFileAsDataUrl,
  isSafeDownloadUrl,
  formatFileSize,
  ALLOWED_ACCEPT_ATTR,
  MAX_DOCUMENT_BYTES,
} from '../../utils/fileSecurity.js';

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
  onOpenDrawer,
  onClose
}) {
  const { 
    state, 
    t, 
    markNotificationRead, 
    markAllNotificationsRead, 
    archiveNotification,
    unarchiveNotification,
    deleteNotification,
    dismissNotification,
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems,
    sendCustomResidentNotice,
    sendDirectMessage,
    fetchMailAttachment,
    executeAutomatedDunningDailyCheck,
    showToast
  } = useApp();

  const { currentUser, currentLang, buildings, notifications, emailRules, emailOutbox, repProfile } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSzvb = currentUser?.role === 'szvb';
  const isAuditor = currentUser?.role === 'auditor';
  const isResident = Boolean(currentUser && !isAdmin && !isSzvb && !isAuditor);

  const activeBuildingId =
    (initialBuildingId && initialBuildingId !== 'all' ? initialBuildingId : null) ||
    state.currentBuildingId ||
    currentUser?.buildingId ||
    buildings?.[0]?.id ||
    null;
  const activeBuilding = useMemo(
    () => (buildings || []).find((b) => b.id === activeBuildingId) || buildings?.[0] || null,
    [buildings, activeBuildingId]
  );

  const orgCtx = useMemo(() => {
    return resolveUserOrgContext(currentUser, state.organizations || [], buildings || []);
  }, [currentUser, state.organizations, buildings]);

  const accessibleBuildings = useMemo(() => {
    return getAccessibleBuildings(currentUser, buildings || [], state.organizations || []);
  }, [currentUser, buildings, state.organizations]);

  const allUserProfiles = useMemo(
    () =>
      resolveUserProfiles(currentUser, {
        buildings: buildings || [],
        organizations: state.organizations || [],
        users: state.users || [],
      }).allProfiles,
    [currentUser, buildings, state.organizations, state.users]
  );

  // Tabs: 'inbox' | 'outbox' | 'archive' | ('rules' strictly for KK)
  const [activeTab, setActiveTab] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [isEditRuleOpen, setIsEditRuleOpen] = useState(false);
  const [viewingLetter, setViewingLetter] = useState(null);
  const [viewingNotification, setViewingNotification] = useState(null);
  const [ruleDryRunTarget, setRuleDryRunTarget] = useState(null);
  const [downloadingAttId, setDownloadingAttId] = useState(null);

  // KK Compose Modal State: 2-step flow (1: Audience & Channels, 2: Compose, Tags & Attachments)
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
  const [composeAttachments, setComposeAttachments] = useState([]);
  const [composeSendEmail, setComposeSendEmail] = useState(true);
  const [composeSendInApp, setComposeSendInApp] = useState(true);
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [isDispatchingRuleId, setIsDispatchingRuleId] = useState(null);
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Universal Direct Compose / Reply Modal State
  const [isDirectComposeOpen, setIsDirectComposeOpen] = useState(false);
  const [directReplyTarget, setDirectReplyTarget] = useState(null);
  const [directRecipientMode, setDirectRecipientMode] = useState('kk');
  const [directIncludeKk, setDirectIncludeKk] = useState(true);
  const [directIncludeSzvb, setDirectIncludeSzvb] = useState(false);
  const [directDeliveryChannel, setDirectDeliveryChannel] = useState('in_app'); // 'both' | 'in_app' | 'email'
  const [directSubject, setDirectSubject] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directAttachments, setDirectAttachments] = useState([]);
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  // Inline Thread Quick-Reply State (Gmail / Outlook style inside viewingNotification)
  const [inlineReplyBody, setInlineReplyBody] = useState('');
  const [inlineReplyAttachments, setInlineReplyAttachments] = useState([]);
  const [inlineReplyChannel, setInlineReplyChannel] = useState('in_app');
  const [isSendingInlineReply, setIsSendingInlineReply] = useState(false);

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
        const debt = (Number(flat.balance) || 0) + (Number(flat.renovationBalance) || 0);
        const ownerRecs = resolveFlatOwnerRecipients(flat, { isEn });

        ownerRecs.forEach(o => {
          recList.push({
            buildingId: b.id,
            buildingName: b.officialName || b.name,
            flatNum: flat.flatNum,
            name: o.name,
            email: o.email || '',
            share: o.share || '',
            isOwner: true,
            isTenant: false,
            sendEmailNotification: o.sendEmailNotification !== false,
            balance: debt,
            balanceFormatted: formatCurrency(debt)
          });
        });

        if (composeIncludeTenants && Array.isArray(flat.tenants)) {
          flat.tenants.forEach(t => {
            const tEmail = (t.email || '').trim();
            const tName = (t.name || '').trim();
            if (tEmail && t.isActive !== false) {
              recList.push({
                buildingId: b.id,
                buildingName: b.officialName || b.name,
                flatNum: flat.flatNum,
                name: tName || (isEn ? `Tenant (${flat.flatNum})` : `Bérlő (${flat.flatNum})`),
                email: tEmail,
                isOwner: false,
                isTenant: true,
                sendEmailNotification: true,
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

  // Active-profile-scoped Inbox, Sent, and Archived messages
  const userNotifications = useMemo(() => {
    return getNotificationsForActiveProfile(notifications || [], currentUser, allUserProfiles);
  }, [notifications, currentUser, allUserProfiles]);

  const userSentMessages = useMemo(() => {
    return getSentMessagesForActiveProfile(notifications || [], currentUser, allUserProfiles);
  }, [notifications, currentUser, allUserProfiles]);

  const userArchivedNotifications = useMemo(() => {
    return getArchivedNotificationsForActiveProfile(notifications || [], currentUser, allUserProfiles);
  }, [notifications, currentUser, allUserProfiles]);

  const activeBuildingAuditor = useMemo(
    () => resolveBuildingAuditorRecipient(activeBuilding),
    [activeBuilding]
  );
  const activeBuildingSzvbList = useMemo(
    () => resolveBuildingSzvbRecipients(activeBuilding),
    [activeBuilding]
  );
  const residentProfileEmail = useMemo(
    () => resolveResidentProfileEmail(currentUser, activeBuilding),
    [currentUser, activeBuilding]
  );
  const residentHasValidEmail = Boolean(residentProfileEmail);

  // Reset tab safely if a non-admin profile somehow had 'rules' active
  useEffect(() => {
    if (!isAdmin && activeTab === 'rules') {
      setActiveTab('inbox');
    }
  }, [isAdmin, activeTab]);

  // If the user's active profile/role changes (e.g. live SZVB/Auditor revocation),
  // immediately close any open compose/reply modal so stale role state can never be submitted.
  useEffect(() => {
    setIsDirectComposeOpen(false);
    setDirectReplyTarget(null);
    setViewingNotification(null);
    setIsComposeOpen(false);
  }, [currentUser?.role, currentUser?.buildingId, currentUser?.flatNum]);

  const matchesSearch = (n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (isEn ? (n.titleEn || n.titleHu) : (n.titleHu || n.titleEn)) || '';
    const msg = (isEn ? (n.messageEn || n.messageHu) : (n.messageHu || n.messageEn)) || '';
    const bldName = n.buildingName || '';
    const actor = n.actorName || n.actorEmail || '';
    const recSummary = (isEn ? n.meta?.recipientSummaryEn : n.meta?.recipientSummaryHu) || '';
    return (
      title.toLowerCase().includes(q) ||
      msg.toLowerCase().includes(q) ||
      bldName.toLowerCase().includes(q) ||
      actor.toLowerCase().includes(q) ||
      recSummary.toLowerCase().includes(q)
    );
  };

  const filteredNotifications = useMemo(() => {
    return userNotifications.filter(matchesSearch);
  }, [userNotifications, searchQuery, isEn]);

  const filteredSentMessages = useMemo(() => {
    return userSentMessages.filter(matchesSearch);
  }, [userSentMessages, searchQuery, isEn]);

  const filteredArchivedNotifications = useMemo(() => {
    return userArchivedNotifications.filter(matchesSearch);
  }, [userArchivedNotifications, searchQuery, isEn]);

  const allProfileMessages = useMemo(() => {
    return [...userNotifications, ...userSentMessages, ...userArchivedNotifications];
  }, [userNotifications, userSentMessages, userArchivedNotifications]);

  const inboxThreads = useMemo(() => {
    return groupNotificationsByThread(filteredNotifications, allProfileMessages);
  }, [filteredNotifications, allProfileMessages]);

  const sentThreads = useMemo(() => {
    return groupNotificationsByThread(filteredSentMessages, allProfileMessages);
  }, [filteredSentMessages, allProfileMessages]);

  const viewingThreadMessages = useMemo(() => {
    if (!viewingNotification) return [];
    return getConversationThreadMessages(allProfileMessages, viewingNotification);
  }, [allProfileMessages, viewingNotification]);

  const viewingReplyTarget = useMemo(() => {
    if (!viewingNotification) return null;
    const myEmail = normalizeEmail(currentUser?.email || '');
    const isReplyableMsg = (m) =>
      Boolean(
        m &&
        !m.meta?.isSenderCopy &&
        m.type !== 'team_updated' &&
        m.type !== 'bank_account_changed' &&
        m.actorEmail &&
        normalizeEmail(m.actorEmail) !== myEmail
      );
    for (let i = viewingThreadMessages.length - 1; i >= 0; i -= 1) {
      if (isReplyableMsg(viewingThreadMessages[i])) {
        return viewingThreadMessages[i];
      }
    }
    return isReplyableMsg(viewingNotification) ? viewingNotification : null;
  }, [viewingNotification, viewingThreadMessages, currentUser]);

  const openThreadViewer = (targetNotif, fullChain = []) => {
    if (!targetNotif) return;
    const chain = Array.isArray(fullChain) && fullChain.length > 0 ? fullChain : [targetNotif];
    chain.forEach((m) => {
      if (m && !m.read && !m.meta?.isSenderCopy && typeof markNotificationRead === 'function') {
        markNotificationRead(m.id);
      }
    });
    setInlineReplyBody('');
    setInlineReplyAttachments([]);
    setInlineReplyChannel(isAuditor ? 'both' : 'in_app');
    setViewingNotification(targetNotif);
  };

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  // Secure multi-file attachment picker (magic-byte + MIME + extension + size validated)
  const handlePickAttachments = async (e, setter) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const accepted = [];
    for (const file of files) {
      const check = await validateUploadFile(file, {
        maxBytes: MAX_DOCUMENT_BYTES,
      });
      if (!check.ok) {
        showToast(getFileValidationErrorMessage(check.reason, t, isEn, 10), 'error');
        continue;
      }
      let dataUrl = '';
      try {
        dataUrl = await readFileAsDataUrl(file);
      } catch {
        dataUrl = '';
      }
      if (!dataUrl || typeof dataUrl !== 'string') continue;
      accepted.push({
        id: `matt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileName: check.sanitizedName || file.name,
        fileType: check.ext || 'file',
        fileSize: check.sizeFormatted || formatFileSize(file.size),
        mimeType: file.type || 'application/octet-stream',
        fileData: dataUrl,
      });
    }

    if (accepted.length > 0) {
      setter((prev) => [...prev, ...accepted].slice(0, 8));
    }
  };

  const handleDownloadAttachment = async (att) => {
    if (!att || downloadingAttId) return;
    setDownloadingAttId(att.id || att.fileName);
    try {
      const url = typeof fetchMailAttachment === 'function' ? await fetchMailAttachment(att) : att.inlineData;
      if (!url || !isSafeDownloadUrl(url)) {
        showToast(isEn ? 'Attachment file is unavailable.' : 'A csatolmány nem tölthető le.', 'error');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName || 'document';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingAttId(null);
    }
  };

  const handleArchiveItem = (notifId, closeViewer = false) => {
    if (!notifId) return;
    if (typeof archiveNotification === 'function') {
      archiveNotification(notifId);
    } else if (typeof dismissNotification === 'function') {
      dismissNotification(notifId);
    }
    if (closeViewer) setViewingNotification(null);
    showToast(isEn ? 'Message archived.' : 'Levél archiválva.', 'info');
  };

  const handleUnarchiveItem = (notifId, closeViewer = false) => {
    if (!notifId || typeof unarchiveNotification !== 'function') return;
    unarchiveNotification(notifId);
    if (closeViewer) setViewingNotification(null);
    showToast(isEn ? 'Message restored from archive.' : 'Levél visszaállítva az archívumból.', 'info');
  };

  const handleDeleteItem = (notifId, closeViewer = false) => {
    if (!notifId || typeof deleteNotification !== 'function') return;
    const confirmMsg = t.mail_delete_confirm || (isEn
      ? 'Are you sure you want to permanently delete this message?'
      : 'Biztosan véglegesen törlöd ezt a levelet?');
    if (!window.confirm(confirmMsg)) return;
    deleteNotification(notifId);
    if (closeViewer) setViewingNotification(null);
    showToast(isEn ? 'Message deleted.' : 'Levél törölve.', 'info');
  };

  const handleOpenDirectCompose = ({ replyTo = null } = {}) => {
    setDirectReplyTarget(replyTo);
    setDirectAttachments([]);
    setDirectIncludeKk(true);
    setDirectIncludeSzvb(false);
    setDirectDeliveryChannel(isAuditor ? 'both' : 'in_app');
    if (replyTo) {
      const origTitle = (isEn ? (replyTo.titleEn || replyTo.titleHu) : (replyTo.titleHu || replyTo.titleEn)) || '';
      setDirectSubject(origTitle.toLowerCase().startsWith('re:') ? origTitle : `Re: ${origTitle}`);
      setDirectBody('');
      setDirectRecipientMode('kk');
    } else {
      setDirectSubject('');
      setDirectBody('');
      if (isAuditor) {
        setDirectRecipientMode(activeBuildingSzvbList.length > 0 ? 'kk_and_szvb' : 'kk');
      } else {
        setDirectRecipientMode('kk');
      }
    }
    setIsDirectComposeOpen(true);
  };

  const handleSendDirectMessage = async () => {
    if (isSendingDirect || typeof sendDirectMessage !== 'function') return;
    const isResidentMultiTarget = isResident && !directReplyTarget && activeBuildingSzvbList.length > 0;
    if (isResidentMultiTarget && !directIncludeKk && !directIncludeSzvb) {
      showToast(
        isEn ? 'Please select at least one recipient!' : 'Kérjük, válassz ki legalább egy címzettet!',
        'error'
      );
      return;
    }
    if (!directSubject.trim()) {
      showToast(isEn ? 'Please enter a subject.' : 'Kérjük, add meg a levél tárgyát!', 'error');
      return;
    }
    if (!directBody.trim()) {
      showToast(isEn ? 'Please enter your message.' : 'Kérjük, írd meg a levél szövegét!', 'error');
      return;
    }

    const canSelectEmailChannel = isAuditor || isResident || Boolean(directReplyTarget);
    const wantsEmail = canSelectEmailChannel && (directDeliveryChannel === 'email' || directDeliveryChannel === 'both');
    if (isResident && wantsEmail && !residentHasValidEmail) {
      showToast(
        isEn
          ? 'Please configure a valid email address in your profile before sending emails.'
          : 'E-mail küldéséhez előbb adj meg egy érvényes e-mail címet a profilodban!',
        'error'
      );
      return;
    }

    const useEmail = canSelectEmailChannel ? wantsEmail : false;
    const useInApp = canSelectEmailChannel
      ? (directDeliveryChannel === 'in_app' || directDeliveryChannel === 'both')
      : true;

    const effectiveRecipientMode = isResidentMultiTarget
      ? (directIncludeKk && directIncludeSzvb
          ? 'kk_and_szvb'
          : directIncludeSzvb
            ? 'szvb'
            : 'kk')
      : directRecipientMode;

    setIsSendingDirect(true);
    try {
      const res = await sendDirectMessage({
        buildingId: directReplyTarget?.buildingId || activeBuilding?.id,
        recipientMode: effectiveRecipientMode,
        includeKk: isResidentMultiTarget ? directIncludeKk : true,
        includeSzvb: isResidentMultiTarget ? directIncludeSzvb : false,
        selectedSzvbEmails: [],
        replyToNotif: directReplyTarget,
        subject: directSubject.trim(),
        body: directBody.trim(),
        category: 'general',
        attachments: directAttachments,
        auditOpinionMeta: null,
        sendInApp: useInApp,
        sendEmail: useEmail,
      });
      if (res?.success) {
        setIsDirectComposeOpen(false);
        setDirectReplyTarget(null);
        setDirectSubject('');
        setDirectBody('');
        setDirectAttachments([]);
        setActiveTab('outbox');
      }
    } finally {
      setIsSendingDirect(false);
    }
  };

  const handleSendInlineReply = async () => {
    if (isSendingInlineReply || !viewingReplyTarget || typeof sendDirectMessage !== 'function') return;
    if (!inlineReplyBody.trim()) {
      showToast(isEn ? 'Please enter your reply.' : 'Kérjük, írd meg a válaszod szövegét!', 'error');
      return;
    }

    const wantsEmail = inlineReplyChannel === 'email' || inlineReplyChannel === 'both';
    if (isResident && wantsEmail && !residentHasValidEmail) {
      showToast(
        isEn
          ? 'Please configure a valid email address in your profile before sending emails.'
          : 'E-mail küldéséhez előbb adj meg egy érvényes e-mail címet a profilodban!',
        'error'
      );
      return;
    }

    const useEmail = wantsEmail && (!isResident || residentHasValidEmail);
    const useInApp = inlineReplyChannel === 'in_app' || inlineReplyChannel === 'both' || !useEmail;

    const baseTitle = (
      isEn
        ? (viewingReplyTarget.titleEn || viewingReplyTarget.titleHu || viewingNotification?.titleEn || viewingNotification?.titleHu)
        : (viewingReplyTarget.titleHu || viewingReplyTarget.titleEn || viewingNotification?.titleHu || viewingNotification?.titleEn)
    ) || (isEn ? 'Message' : 'Üzenet');
    const replySubject = baseTitle.toLowerCase().startsWith('re:') ? baseTitle : `Re: ${baseTitle}`;

    setIsSendingInlineReply(true);
    try {
      const res = await sendDirectMessage({
        buildingId: viewingReplyTarget.buildingId || viewingNotification?.buildingId || activeBuilding?.id,
        recipientMode: 'kk',
        replyToNotif: viewingReplyTarget,
        subject: replySubject,
        body: inlineReplyBody.trim(),
        category: 'general',
        attachments: inlineReplyAttachments,
        auditOpinionMeta: null,
        sendInApp: useInApp,
        sendEmail: useEmail,
      });
      if (res?.success) {
        setInlineReplyBody('');
        setInlineReplyAttachments([]);
      }
    } finally {
      setIsSendingInlineReply(false);
    }
  };

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

  const handleSimulateRuleDispatch = async (rule, { sendReal = true } = {}) => {
    if (!canManageAnyBuilding) {
      showToast(t.comm_viewer_action_blocked || (isEn ? "Action blocked: Viewers cannot trigger notices." : "Művelet megtagadva: Megtekintők nem futtathatnak felszólításokat."), "error");
      return;
    }
    const matches = runDunningDryRun(rule, buildings || [], {}, { isEn, repProfile });
    if (matches.length === 0) {
      showToast(isEn ? "No units currently match this rule condition." : "Jelenleg egyetlen lakás sem felel meg a szabály feltételeinek.", "info");
      return;
    }

    if (sendReal && executeAutomatedDunningDailyCheck) {
      setIsDispatchingRuleId(rule.id);
      try {
        const result = await executeAutomatedDunningDailyCheck({ forceRuleId: rule.id });
        if (result?.ran) {
          showToast(isEn 
            ? `Successfully dispatched notices to ${result.totalSent || matches.length} units!` 
            : `Sikeresen kiküldve ${result.totalSent || matches.length} érintett lakásnak!`, "success");
        } else if (result?.reason === 'no-matching-flats') {
          showToast(isEn ? "No units match this rule condition." : "Jelenleg egyetlen lakás sem felel meg a feltételeknek.", "info");
        } else {
          showToast(isEn ? "Notices processed and logged." : "Értesítők feldolgozva és naplózva.", "info");
        }
      } catch (err) {
        console.error('Error dispatching rule:', err);
        showToast(err?.message || (isEn ? "Error dispatching notices." : "Hiba a levelek kiküldésekor."), "error");
      } finally {
        setIsDispatchingRuleId(null);
      }
      return;
    }

    const outboxPayloads = [];
    matches.forEach(m => {
      const recs = (Array.isArray(m.ownerRecipients) && m.ownerRecipients.length > 0)
        ? m.ownerRecipients
        : [{ name: m.ownerName, email: m.ownerEmail }];

      recs.forEach(r => {
        outboxPayloads.push({
          ruleId: rule.id,
          ruleName: isEn ? (rule.nameEn || rule.name) : rule.name,
          buildingId: m.buildingId,
          buildingName: m.buildingName,
          flatNum: m.flatNum,
          recipientName: r.name || m.ownerName,
          recipientEmail: r.email || (isEn ? "No email provided" : "Nincs e-mail"),
          subject: m.renderedSubject,
          body: m.renderedBody,
          debt: m.balance,
          arrearsMonths: m.arrearsMonths,
          sendEmail: rule.sendEmail !== false,
          sendInApp: rule.sendInApp !== false,
          status: 'simulated'
        });
      });
    });

    queueOutboxItems(outboxPayloads);
    showToast(isEn 
      ? `Simulated & queued ${outboxPayloads.length} notices in the Outbox!` 
      : `${outboxPayloads.length} db értesítő sikeresen bejegyezve a Kiküldési naplóba!`, "info");
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

    const noticePayload = {
      buildingId: composeTargetBuildingId,
      recipients: resolvedRecipients,
      category: 'general',
      subject: composeSubject.trim(),
      body: composeBody.trim(),
      attachments: composeAttachments,
      sendEmail: composeSendEmail,
      sendInAppNotification: composeSendInApp
    };
    const recipientCount = resolvedRecipients.length;

    setIsSendingNotice(true);
    try {
      const result = await sendCustomResidentNotice(noticePayload);

      if (result && result.success) {
        showToast(
          (t.comm_sent_toast || (isEn ? "Letter successfully sent to {count} recipient(s)!" : "Levél sikeresen kiküldve {count} címzettnek!"))
            .replace('{count}', recipientCount),
          "success"
        );
        setComposeSubject('');
        setComposeBody('');
        setComposeAttachments([]);
        setComposeCustomFlats([]);
        setComposeStep(1);
        setIsComposeOpen(false);
        setActiveTab('outbox');
      }
    } catch (err) {
      console.error('Error sending custom notice:', err);
      showToast(err?.message || (isEn ? "Error dispatching notices." : "Hiba a levélküldéskor."), "error");
    } finally {
      setIsSendingNotice(false);
    }
  };

  useEffect(() => {
    if (!isSendingNotice && !isDispatchingRuleId && !isSendingDirect) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSendingNotice, isDispatchingRuleId, isSendingDirect]);

  const handleRequestClose = () => {
    if (isSendingNotice || isDispatchingRuleId || isSendingDirect) {
      const warningText = t.comm_sending_leave_warning || (isEn
        ? "Warning: Email sending is still in progress! The message has not been delivered yet. If you close the window now, sending will be cancelled. Are you sure you want to exit?"
        : "Figyelem: A levél kiküldése még folyamatban van! Az üzenet még nem ment át a lakóknak. Ha most bezárod az ablakot, a küldés megszakad és a lakók nem kapják meg a levelet. Biztosan kilépsz?");
      if (!window.confirm(warningText)) {
        return;
      }
    }
    onClose();
  };

  const handleCloseCompose = () => {
    if (isSendingNotice) {
      const warningText = t.comm_sending_leave_warning || (isEn
        ? "Warning: Email sending is still in progress! The message has not been delivered yet. If you close the window now, sending will be cancelled. Are you sure you want to exit?"
        : "Figyelem: A levél kiküldése még folyamatban van! Az üzenet még nem ment át a lakóknak. Ha most bezárod az ablakot, a küldés megszakad és a lakók nem kapják meg a levelet. Biztosan kilépsz?");
      if (!window.confirm(warningText)) {
        return;
      }
    }
    setIsComposeOpen(false);
  };

  // Safe early return strictly after all hooks (available to ALL authenticated profiles)
  if (!isOpen || !currentUser) return null;

  const totalSentCount = isAdmin
    ? (filteredSentMessages.length + (emailOutbox || []).length)
    : userSentMessages.length;

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-20 w-full shadow-xs bg-white border-b border-gray-200">
        <ImpersonationBanner onExit={onClose} />
        <div className="px-3 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3">
          {/* Left: Menu, Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
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
            <NavLogoButton onClick={handleRequestClose} hideViewerBadge={isAdmin} />
            <div className="hidden sm:block h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
                  {isAdmin
                    ? (t.comm_center_title || (isEn ? "Communication & Email Center" : "Kommunikációs & E-mail Központ"))
                    : (t.mail_center_title || (isEn ? "Messages & Mail" : "Levelezés & Üzenetek"))}
                </h1>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {isAdmin
                    ? (isEn ? "Profile messages, attachments, archive, dunning rules & outgoing logs" : "Profil üzenetek, csatolmányok, archívum, felszólítási szabályok és kiküldési napló")
                    : isAuditor
                    ? (isEn ? "Submit official audit opinions, observations & attachments to Management and SZVB" : "Hivatalos szakmai vélemények, észrevételek és dokumentumok küldése a KK és az SZVB részére")
                    : isSzvb
                    ? (isEn ? "Correspondence with Management and Financial Auditor, with attachments & archive" : "Levelezés a Közös Képviselettel és a Gazdasági ellenőrrel, csatolmányokkal és archívummal")
                    : (isEn ? "Messages with Common Representative (Management), attachments & archive" : "Levelezés a Közös Képviselettel, dokumentum csatolással és archívummal")}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Role-aware Compose button & Close */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {isAdmin ? (
              canManageAnyBuilding ? (
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
              )
            ) : (
              <button
                type="button"
                onClick={() => handleOpenDirectCompose()}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isResident
                    ? (t.mail_compose_to_kk_btn || (isEn ? "Write Message" : "Levél írása"))
                    : (t.comm_compose_btn || (isEn ? "New Message" : "Új levél írása"))}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRequestClose}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              title={isEn ? "Close" : "Bezárás"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Pénzügyek-style Segmented Tab Bar */}
          <div
            role="tablist"
            aria-label={isEn ? "Messages & Mail" : "Levelezés & Üzenetek"}
            className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'inbox'}
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeTab === 'inbox'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <Bell className={`w-4 h-4 shrink-0 ${activeTab === 'inbox' ? 'text-white' : 'text-gray-500'}`} />
              <span>{t.mail_tab_inbox || (isEn ? "Inbox" : "Beérkezett")}</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'outbox'}
              onClick={() => setActiveTab('outbox')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeTab === 'outbox'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <History className={`w-4 h-4 shrink-0 ${activeTab === 'outbox' ? 'text-white' : 'text-gray-500'}`} />
              <span>
                {isAdmin
                  ? (t.comm_tab_outbox || (isEn ? "Sent & Outbox" : "Elküldött & Napló"))
                  : (t.mail_tab_sent || (isEn ? "Sent" : "Elküldött"))}
              </span>
              {totalSentCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                  activeTab === 'outbox' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  {totalSentCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'archive'}
              onClick={() => setActiveTab('archive')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                activeTab === 'archive'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              <Archive className={`w-4 h-4 shrink-0 ${activeTab === 'archive' ? 'text-white' : 'text-gray-500'}`} />
              <span>{t.mail_tab_archive || (isEn ? "Archive" : "Archívum")}</span>
              {userArchivedNotifications.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                  activeTab === 'archive' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  {userArchivedNotifications.length}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'rules'}
                onClick={() => setActiveTab('rules')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  activeTab === 'rules'
                    ? 'bg-[#1E3A8A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                }`}
              >
                <Settings2 className={`w-4 h-4 shrink-0 ${activeTab === 'rules' ? 'text-white' : 'text-gray-500'}`} />
                <span>{t.comm_tab_rules || (isEn ? "Dunning Rules" : "Felszólítási Szabályok")}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                  activeTab === 'rules' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#1E3A8A]'
                }`}>
                  {activeRules.length}
                </span>
              </button>
            )}
          </div>

          {/* Search Box & Contextual Tab Action */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? "Search..." : "Keresés..."}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl shadow-2xs focus:outline-none focus:border-[#1E3A8A]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && activeTab === 'rules' && canManageAnyBuilding && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setIsEditRuleOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? "New Rule" : "Új szabály"}</span>
                </button>
              )}

              {activeTab === 'inbox' && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex-shrink-0 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isEn ? "Mark all read" : "Mind olvasott"}</span>
                </button>
              )}

              {isAdmin && activeTab === 'outbox' && (emailOutbox || []).length > 0 && canManageAnyBuilding && (
                <button
                  type="button"
                  onClick={clearOutboxItems}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex-shrink-0 cursor-pointer"
                  title={isEn ? "Clear simulated outbox" : "Napló kiürítése"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isEn ? "Clear" : "Ürítés"}</span>
                </button>
              )}
            </div>
          </div>
          
          {/* TAB 1: INBOX & PROFILE NOTIFICATIONS (Threaded Gmail / Outlook view) */}
          {activeTab === 'inbox' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden animate-fadeIn">
              {inboxThreads.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <Mail className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-500">
                    {t.notif_empty || (isEn ? "No notifications or system messages found." : "Nincs új értesítés vagy rendszerüzenet.")}
                  </p>
                </div>
              ) : (
                inboxThreads.map((thread) => {
                  const notif = thread.latest;
                  const isUnread = thread.hasUnread || !notif.read;
                  const isCritical = notif.severity === 'critical';
                  const title = isEn ? (notif.titleEn || notif.titleHu) : (notif.titleHu || notif.titleEn);
                  const message = isEn ? (notif.messageEn || notif.messageHu) : (notif.messageHu || notif.messageEn);

                  return (
                    <div
                      key={thread.key}
                      onClick={() => openThreadViewer(notif, thread.fullChain)}
                      className={`p-4 transition-colors cursor-pointer relative group border-l-4 flex items-start justify-between gap-4 ${
                        isCritical
                          ? !isUnread
                            ? 'bg-red-50/50 hover:bg-red-50/70 border-l-red-400'
                            : 'bg-red-50/90 hover:bg-red-100/70 border-l-red-500'
                          : !isUnread
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
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                            )}
                            {thread.threadCount > 1 && (
                              <span
                                className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold inline-flex items-center gap-1"
                                title={isEn ? `${thread.threadCount} messages in conversation` : `${thread.threadCount} üzenet a levelezésben`}
                              >
                                <Reply className="w-2.5 h-2.5" />
                                <span>{thread.threadCount}</span>
                              </span>
                            )}
                            {notif.meta?.isOfficialOpinion && (
                              <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold inline-flex items-center gap-1">
                                <ClipboardCheck className="w-3 h-3" />
                                <span>{isEn ? `Audit Opinion (${notif.meta.year || ''})` : `Szakmai vélemény (${notif.meta.year || ''})`}</span>
                              </span>
                            )}
                            {notif.meta?.isAuditObservation && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                {isEn ? 'Audit Observation' : 'Ellenőri észrevétel'}
                              </span>
                            )}
                            {(notif.actorName || notif.actorEmail || notif.meta?.senderRoleLabelHu || notif.meta?.senderRoleLabelEn) && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-[10px] font-bold">
                                👤 {isEn ? 'From:' : 'Feladó:'}{' '}
                                {notif.actorName || notif.actorEmail}
                                {(notif.meta?.senderRoleLabelHu || notif.meta?.senderRoleLabelEn)
                                  ? ` · ${isEn ? notif.meta.senderRoleLabelEn : notif.meta.senderRoleLabelHu}`
                                  : ''}
                              </span>
                            )}
                            {notif.buildingName && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                                🏢 {notif.buildingName}
                              </span>
                            )}
                            {Array.isArray(notif.attachments) && notif.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                <Paperclip className="w-3 h-3" />
                                <span>{notif.attachments.length}</span>
                              </span>
                            )}
                          </div>

                          <p className={`text-xs leading-relaxed line-clamp-2 ${isCritical ? 'text-red-950 font-medium' : 'text-gray-600'}`}>
                            {message}
                          </p>

                          {/* Structured changes breakdown (bank accounts or team permissions) */}
                          {Array.isArray(notif.changes) && notif.changes.length > 0 && (
                            <div className="mt-2 space-y-1.5 bg-white/80 border border-gray-200/90 rounded-xl p-2.5">
                              {notif.changes.map((ch, idx) => {
                                if (ch.oldAccount !== undefined) {
                                  return (
                                    <div key={idx} className="text-xs font-mono text-red-950 break-all">
                                      <span className="font-sans font-bold text-red-800">
                                        {isEn ? ch.accountLabelEn : ch.accountLabelHu}:
                                      </span>{' '}
                                      <span className="line-through text-red-500">{ch.oldAccount}</span>{' '}
                                      →{' '}
                                      <span className="font-bold text-red-900">{ch.newAccount}</span>
                                    </div>
                                  );
                                }
                                const badgeStyle = ch.type === 'granted'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : ch.type === 'revoked'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200';
                                const badgeText = ch.type === 'granted'
                                  ? (t.team_change_granted || (isEn ? '+ Granted' : '+ Megadva'))
                                  : ch.type === 'revoked'
                                  ? (t.team_change_revoked || (isEn ? '− Revoked' : '− Visszavonva'))
                                  : (t.team_change_modified || (isEn ? '~ Modified' : '~ Módosítva'));

                                return (
                                  <div key={idx} className="flex items-start gap-1.5 text-xs text-gray-800 leading-snug">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badgeStyle}`}>
                                      {badgeText}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                      {isEn ? (ch.labelEn || ch.labelHu) : (ch.labelHu || ch.labelEn)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(notif.createdAt, isEn)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveItem(notif.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E3A8A] hover:bg-blue-50 opacity-75 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                          title={t.mail_archive_btn || (isEn ? "Archive" : "Archiválás")}
                        >
                          <Archive className="w-4 h-4" />
                          <span className="hidden sm:inline">{t.mail_archive_btn || (isEn ? "Archive" : "Archiválás")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(notif.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-75 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                          title={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                          aria-label={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: AUTOMATED DUNNING & NOTIFICATION RULES (Strictly KK / Admin only) */}
          {isAdmin && activeTab === 'rules' && (
            <div className="space-y-4 animate-fadeIn">
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
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                                ⏰ {t.comm_rule_schedule_chip ? t.comm_rule_schedule_chip.replace('{day}', rule.checkDayOfMonth || 15).replace('{time}', rule.dispatchTime || '08:00') : (isEn ? `Every month ${rule.checkDayOfMonth || 15}th – ${rule.dispatchTime || '08:00'}` : `Minden hó ${rule.checkDayOfMonth || 15}. – ${rule.dispatchTime || '08:00'}`)}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] text-[10px] font-bold border border-blue-200">
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
                                disabled={isDispatchingRuleId === rule.id}
                                onClick={() => handleSimulateRuleDispatch(rule, { sendReal: true })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                                title={t.comm_dispatch_now_desc || (isEn ? "Execute rule now and send real emails" : "Szabály azonnali futtatása és e-mailek valós kiküldése")}
                              >
                                <Play className="w-3.5 h-3.5 text-emerald-700" />
                                <span>
                                  {isDispatchingRuleId === rule.id 
                                    ? (t.comm_dispatching || (isEn ? "Dispatching..." : "Kiküldés...")) 
                                    : (t.comm_dispatch_now || (isEn ? "Dispatch Now" : "Kiküldés most"))}
                                </span>
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

          {/* TAB 3: SENT & OUTBOX DELIVERY LOGS */}
          {activeTab === 'outbox' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Direct Sent Messages (visible for ALL profiles — own profile's sent correspondence & opinions) */}
              {sentThreads.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
                  {isAdmin && (
                    <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      {isEn ? "Direct Replies & Messages Sent" : "Elküldött közvetlen levelek & válaszok"} ({sentThreads.length})
                    </div>
                  )}
                  {sentThreads.map((thread) => {
                    const msg = thread.latest;
                    const title = isEn ? (msg.titleEn || msg.titleHu) : (msg.titleHu || msg.titleEn);
                    const body = isEn ? (msg.messageEn || msg.messageHu) : (msg.messageHu || msg.messageEn);
                    const recSummary = (isEn ? msg.meta?.recipientSummaryEn : msg.meta?.recipientSummaryHu) || '';
                    return (
                      <div
                        key={thread.key}
                        onClick={() => openThreadViewer(msg, thread.fullChain)}
                        className="p-4 hover:bg-gray-50/80 transition-colors cursor-pointer flex items-start justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            msg.meta?.isOfficialOpinion ? 'bg-teal-100 text-teal-700' : 'bg-blue-50 text-[#1E3A8A]'
                          }`}>
                            {msg.meta?.isOfficialOpinion ? <ClipboardCheck className="w-5 h-5" /> : <Send className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-bold text-gray-900 font-display">{title}</span>
                              {thread.threadCount > 1 && (
                                <span
                                  className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold inline-flex items-center gap-1"
                                  title={isEn ? `${thread.threadCount} messages in conversation` : `${thread.threadCount} üzenet a levelezésben`}
                                >
                                  <Reply className="w-2.5 h-2.5" />
                                  <span>{thread.threadCount}</span>
                                </span>
                              )}
                              {msg.meta?.isOfficialOpinion && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                  {isEn ? `Official Opinion (${msg.meta.year || ''})` : `Hivatalos vélemény (${msg.meta.year || ''})`}
                                </span>
                              )}
                              {recSummary && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                                  → {recSummary}
                                </span>
                              )}
                              {msg.meta?.deliveryChannel && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-[10px] font-bold">
                                  {msg.meta.deliveryChannel === 'both'
                                    ? (isEn ? 'Email + In-App' : 'E-mail + App')
                                    : msg.meta.deliveryChannel === 'email'
                                    ? (isEn ? 'Email only' : 'Csak e-mail')
                                    : (isEn ? 'In-App' : 'Alkalmazásban')}
                                </span>
                              )}
                              {msg.buildingName && (
                                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                                  🏢 {msg.buildingName}
                                </span>
                              )}
                              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                  <Paperclip className="w-3 h-3" />
                                  <span>{msg.attachments.length}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{body}</p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatTime(msg.createdAt, isEn)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveItem(msg.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E3A8A] hover:bg-blue-50 opacity-75 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                            title={t.mail_archive_btn || (isEn ? "Archive" : "Archiválás")}
                          >
                            <Archive className="w-4 h-4" />
                            <span className="hidden sm:inline">{t.mail_archive_btn || (isEn ? "Archive" : "Archiválás")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(msg.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-75 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                            title={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                            aria-label={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* KK Outbox & Delivery Logs (Strictly KK / Admin only) */}
              {isAdmin && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
                  {filteredSentMessages.length > 0 && (
                    <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      {isEn ? "Broadcast & Automated Email Delivery Log" : "Körlevelek és automatikus kiküldési napló"} ({outboxItems.length})
                    </div>
                  )}
                  {outboxItems.length === 0 ? (
                    filteredSentMessages.length === 0 && (
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
                    )
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
                            {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                <Paperclip className="w-3 h-3" />
                                <span>{item.attachments.length}</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                            <span>🏢 {item.buildingName}{item.flatNum ? ` • ${item.flatNum}. ${isEn ? 'flat' : 'lakás'}` : ''}</span>
                            <span>&bull;</span>
                            <span>👤 {item.recipientName} ({item.recipientEmail})</span>
                            {item.debt !== undefined && item.debt !== null && item.debt !== 0 && (
                              <>
                                <span>&bull;</span>
                                <span className="text-red-600 font-bold">{formatCurrency(item.debt)}</span>
                              </>
                            )}
                          </div>
                          {item.status === 'failed' && item.errorMessage && (
                            <div className="text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 mt-1 inline-block font-medium">
                              ⚠️ {item.errorMessage}
                            </div>
                          )}
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

              {/* Empty state for non-admin profiles when no sent messages yet */}
              {!isAdmin && filteredSentMessages.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs py-16 text-center text-gray-400 space-y-3">
                  <Send className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">
                    {isEn ? "You haven't sent any messages from this profile yet." : "Még nem küldtél levelet ebből a profilból."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARCHIVE (ALL profiles — view & restore archived letters anytime) */}
          {activeTab === 'archive' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden animate-fadeIn">
              {filteredArchivedNotifications.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-3">
                  <Archive className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="text-xs font-semibold text-gray-500">
                    {t.mail_archive_empty || (isEn ? "Your archive is empty. Archived letters will stay here so you can read them anytime." : "Az archívum jelenleg üres. Az archivált levelek itt maradnak megőrizve, és bármikor visszakereshetők.")}
                  </p>
                </div>
              ) : (
                filteredArchivedNotifications.map((notif) => {
                  const title = isEn ? (notif.titleEn || notif.titleHu) : (notif.titleHu || notif.titleEn);
                  const message = isEn ? (notif.messageEn || notif.messageHu) : (notif.messageHu || notif.messageEn);
                  const isSentCopy = Boolean(notif.meta?.isSenderCopy);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => setViewingNotification(notif)}
                      className="p-4 bg-white hover:bg-gray-50/80 transition-colors cursor-pointer flex items-start justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                          <Archive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-gray-800 font-display">{title}</span>
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                              {isSentCopy ? (isEn ? 'Sent' : 'Elküldött') : (isEn ? 'Received' : 'Beérkezett')}
                            </span>
                            {!isSentCopy && (notif.actorName || notif.actorEmail || notif.meta?.senderRoleLabelHu) && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-[10px] font-bold">
                                👤 {isEn ? 'From:' : 'Feladó:'}{' '}
                                {notif.actorName || notif.actorEmail}
                                {(notif.meta?.senderRoleLabelHu || notif.meta?.senderRoleLabelEn)
                                  ? ` · ${isEn ? notif.meta.senderRoleLabelEn : notif.meta.senderRoleLabelHu}`
                                  : ''}
                              </span>
                            )}
                            {notif.buildingName && (
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                                🏢 {notif.buildingName}
                              </span>
                            )}
                            {Array.isArray(notif.attachments) && notif.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                <Paperclip className="w-3 h-3" />
                                <span>{notif.attachments.length}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{message}</p>
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(notif.createdAt, isEn)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchiveItem(notif.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#1E3A8A] hover:bg-blue-50 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold border border-gray-200 bg-white"
                          title={t.mail_restore_btn || (isEn ? "Restore to Inbox" : "Visszaállítás")}
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.mail_restore_btn || (isEn ? "Restore" : "Visszaállítás")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(notif.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold border border-gray-200 bg-white"
                          title={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                          aria-label={t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>

      {/* SUBMODAL 1: COMPOSE NOTICE MODAL (2-STEP WIZARD) */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
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
                onClick={handleCloseCompose}
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
                      { tag: '{osszesTulajdonos}', label: isEn ? "All Owners" : "Összes tulajdonos", icon: "👥" },
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

                {/* Document Attachments Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>{t.mail_attachments_label || (isEn ? "Attach Documents (optional)" : "Dokumentumok csatolása (opcionális)")}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1E3A8A] text-[11px] font-bold cursor-pointer transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.mail_add_file_btn || (isEn ? "Attach File" : "Fájl csatolása")}</span>
                      <input
                        type="file"
                        multiple
                        accept={ALLOWED_ACCEPT_ATTR}
                        onChange={(e) => handlePickAttachments(e, setComposeAttachments)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {composeAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {composeAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-800"
                        >
                          <Paperclip className="w-3 h-3 text-gray-500 shrink-0" />
                          <span className="font-semibold truncate max-w-[180px]">{att.fileName}</span>
                          {att.fileSize && <span className="text-[10px] text-gray-500">({att.fileSize})</span>}
                          <button
                            type="button"
                            onClick={() => setComposeAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                            className="p-0.5 text-gray-400 hover:text-red-600 cursor-pointer"
                            title={isEn ? "Remove attachment" : "Csatolmány eltávolítása"}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    onClick={handleCloseCompose}
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
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
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
              {Array.isArray(viewingLetter.attachments) && viewingLetter.attachments.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                    {isEn ? "Attachments" : "Csatolmányok"} ({viewingLetter.attachments.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {viewingLetter.attachments.map((att) => (
                      <button
                        key={att.id || att.fileName}
                        type="button"
                        disabled={downloadingAttId === (att.id || att.fileName)}
                        onClick={() => handleDownloadAttachment(att)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-[#1E3A8A] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">{att.fileName}</span>
                        {att.fileSize && <span className="text-[10px] font-normal text-blue-700/80">({att.fileSize})</span>}
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {/* SUBMODAL: Full View for In-App Messages / Correspondence / Opinions */}
      {viewingNotification && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  viewingNotification.severity === 'critical'
                    ? 'bg-red-100 text-red-700'
                    : viewingNotification.meta?.isOfficialOpinion
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-blue-100 text-[#1E3A8A]'
                }`}>
                  {viewingNotification.severity === 'critical'
                    ? <ShieldAlert className="w-4 h-4" />
                    : viewingNotification.meta?.isOfficialOpinion
                    ? <ClipboardCheck className="w-4 h-4" />
                    : <Mail className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 font-display">
                      {viewingNotification.meta?.isOfficialOpinion
                        ? (isEn ? "Official Financial Audit Opinion" : "Hivatalos írásbeli szakmai vélemény")
                        : viewingThreadMessages.length > 1
                        ? (isEn ? "Conversation Thread" : "Levelezési lánc")
                        : (t.notif_modal_title || (isEn ? "Message Details" : "Levél részletei"))}
                    </h3>
                    {viewingThreadMessages.length > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold">
                        {viewingThreadMessages.length} {isEn ? 'messages' : 'üzenet'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {formatTime(
                      viewingThreadMessages[viewingThreadMessages.length - 1]?.createdAt || viewingNotification.createdAt,
                      isEn
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingNotification(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Thread Subject Header */}
              <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                    {isEn ? "Subject / Title" : "Tárgy / Cím"}
                  </span>
                  <h4 className="font-extrabold text-gray-900 text-base leading-snug">
                    {(() => {
                      const firstMsg = viewingThreadMessages[0] || viewingNotification;
                      const rawTitle = isEn
                        ? (firstMsg.titleEn || firstMsg.titleHu || viewingNotification.titleEn || viewingNotification.titleHu)
                        : (firstMsg.titleHu || firstMsg.titleEn || viewingNotification.titleHu || viewingNotification.titleEn);
                      return (rawTitle || '').replace(/^Re:\s*/i, '');
                    })()}
                  </h4>
                </div>
                {viewingNotification.buildingName && (
                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold shrink-0">
                    🏢 {viewingNotification.buildingName}
                  </span>
                )}
              </div>

              {/* Chronological Gmail / Outlook Conversation Chain (oldest -> newest) */}
              <div className="space-y-3">
                {(viewingThreadMessages.length > 0 ? viewingThreadMessages : [viewingNotification]).map((msg, msgIdx) => {
                  const isMine = Boolean(
                    msg.meta?.isSenderCopy ||
                    (msg.actorEmail && normalizeEmail(msg.actorEmail) === normalizeEmail(currentUser?.email))
                  );
                  const recSummary = (isEn ? msg.meta?.recipientSummaryEn : msg.meta?.recipientSummaryHu) || '';
                  const senderRoleLabel = isEn ? msg.meta?.senderRoleLabelEn : msg.meta?.senderRoleLabelHu;
                  const rawBody = (() => {
                    const text = isEn
                      ? (msg.messageEn || msg.messageHu || '')
                      : (msg.messageHu || msg.messageEn || '');
                    if (msg.type === 'team_updated' && Array.isArray(msg.changes) && msg.changes.length > 0) {
                      return text.split('\n\n')[0];
                    }
                    return text;
                  })();

                  return (
                    <div
                      key={msg.id || msgIdx}
                      className={`rounded-2xl border overflow-hidden transition-all ${
                        isMine
                          ? 'border-blue-200 bg-blue-50/30'
                          : 'border-gray-200 bg-white shadow-2xs'
                      }`}
                    >
                      {/* Message Card Header */}
                      <div
                        className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 flex-wrap ${
                          isMine
                            ? 'bg-blue-50/70 border-blue-100'
                            : 'bg-gray-50/80 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                              isMine
                                ? 'bg-[#1E3A8A] text-white'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            {isMine ? (isEn ? 'Me' : 'Én') : (msg.actorName || msg.actorEmail || (isEn ? 'System' : 'Rendszer'))}
                          </span>
                          {!isMine && senderRoleLabel && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1E3A8A] text-[10px] font-bold">
                              {senderRoleLabel}
                            </span>
                          )}
                          {recSummary && (
                            <span className="text-[11px] text-gray-500 truncate">
                              → <strong className="text-gray-700">{recSummary}</strong>
                            </span>
                          )}
                          {msg.meta?.deliveryChannel && (
                            <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600 text-[10px] font-semibold">
                              {msg.meta.deliveryChannel === 'both'
                                ? (isEn ? 'Email + App' : 'E-mail + App')
                                : msg.meta.deliveryChannel === 'email'
                                ? (isEn ? 'Email' : 'E-mail')
                                : (isEn ? 'In-App' : 'App')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">
                          {formatTime(msg.createdAt, isEn)}
                        </span>
                      </div>

                      {/* Message Card Body */}
                      <div className="p-4 space-y-3">
                        {msg.meta?.isOfficialOpinion && (
                          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-wrap items-center gap-2 text-xs text-teal-900">
                            <ClipboardCheck className="w-4 h-4 text-teal-700 shrink-0" />
                            <span className="font-bold">
                              {isEn ? `Fiscal Year: ${msg.meta.year}` : `Elszámolási év: ${msg.meta.year}`}
                            </span>
                            <span>&bull;</span>
                            <span className="font-bold">
                              {msg.meta.verdict === 'approved'
                                ? (isEn ? 'Recommended for approval' : 'Elfogadásra javasolt')
                                : msg.meta.verdict === 'approved_with_notes'
                                ? (isEn ? 'Approved with notes' : 'Megjegyzéssel elfogadható')
                                : (isEn ? 'Objected / Revision required' : 'Kifogásolt / Javítás szükséges')}
                            </span>
                          </div>
                        )}

                        <div className="text-xs whitespace-pre-wrap text-gray-800 leading-relaxed font-sans select-text">
                          {rawBody}
                        </div>

                        {/* Downloadable Attachments */}
                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                              {isEn ? "Attachments" : "Csatolmányok"} ({msg.attachments.length})
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {msg.attachments.map((att) => (
                                <button
                                  key={att.id || att.fileName}
                                  type="button"
                                  disabled={downloadingAttId === (att.id || att.fileName)}
                                  onClick={() => handleDownloadAttachment(att)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-[#1E3A8A] text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-[220px]">{att.fileName}</span>
                                  {att.fileSize && <span className="text-[10px] font-normal text-blue-700/80">({att.fileSize})</span>}
                                  <Download className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Structured changes breakdown (bank accounts or team permissions) */}
                        {Array.isArray(msg.changes) && msg.changes.length > 0 && (
                          <div className="space-y-2 bg-gray-50/90 border border-gray-200/90 rounded-2xl p-3.5">
                            <span className="text-xs font-bold text-gray-900 block mb-1">
                              {msg.type === 'team_updated'
                                ? (isEn ? "Detailed Changes:" : "Részletes változások:")
                                : (isEn ? "Account Details Modification:" : "Módosított bankszámla adatok:")}
                            </span>
                            {msg.changes.map((ch, idx) => {
                              if (ch.oldAccount !== undefined) {
                                return (
                                  <div key={idx} className="text-xs font-mono text-red-950 break-all bg-white p-2 rounded-xl border border-red-200">
                                    <span className="font-sans font-bold text-red-800">
                                      {isEn ? ch.accountLabelEn : ch.accountLabelHu}:
                                    </span>{' '}
                                    <span className="line-through text-red-500">{ch.oldAccount}</span>{' '}
                                    →{' '}
                                    <span className="font-bold text-red-900">{ch.newAccount}</span>
                                  </div>
                                );
                              }
                              const badgeStyle = ch.type === 'granted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : ch.type === 'revoked'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200';
                              const badgeText = ch.type === 'granted'
                                ? (t.team_change_granted || (isEn ? '+ Granted' : '+ Megadva'))
                                : ch.type === 'revoked'
                                ? (t.team_change_revoked || (isEn ? '− Revoked' : '− Visszavonva'))
                                : (t.team_change_modified || (isEn ? '~ Modified' : '~ Módosítva'));

                              return (
                                <div key={idx} className="flex items-start gap-2 p-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-800">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badgeStyle}`}>
                                    {badgeText}
                                  </span>
                                  <span className="font-medium text-gray-700 leading-snug">
                                    {isEn ? (ch.labelEn || ch.labelHu) : (ch.labelHu || ch.labelEn)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Gmail / Outlook Quick Reply Box */}
              {viewingReplyTarget && (!isAdmin || canManageAnyBuilding) && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/35 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A]">
                      <Reply className="w-4 h-4 shrink-0" />
                      <span>
                        {isEn
                          ? `Reply to ${viewingReplyTarget.actorName || viewingReplyTarget.actorEmail}`
                          : `Válasz ide: ${viewingReplyTarget.actorName || viewingReplyTarget.actorEmail}`}
                      </span>
                      {(viewingReplyTarget.meta?.senderRoleLabelHu || viewingReplyTarget.meta?.senderRoleLabelEn) && (
                        <span className="px-1.5 py-0.5 rounded-full bg-white border border-blue-200 text-[10px] font-bold text-[#1E3A8A]">
                          {isEn ? viewingReplyTarget.meta.senderRoleLabelEn : viewingReplyTarget.meta.senderRoleLabelHu}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'in_app', label: isEn ? 'In-App' : 'Appban', requiresEmail: false },
                        { id: 'both', label: isEn ? 'Email + App' : 'E-mail + App', requiresEmail: true },
                        { id: 'email', label: isEn ? 'Email only' : 'Csak e-mail', requiresEmail: true },
                      ].map((ch) => {
                        const isDisabled = isResident && ch.requiresEmail && !residentHasValidEmail;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setInlineReplyChannel(ch.id)}
                            title={
                              isDisabled
                                ? (isEn ? 'Set an email address in your profile to send emails' : 'Add meg az e-mail címed a profilodban e-mail küldéséhez')
                                : ch.label
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              inlineReplyChannel === ch.id
                                ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isResident && !residentHasValidEmail && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        {isEn
                          ? 'No email address is set in your profile — email replies are disabled until you add one.'
                          : 'Nincs beállított e-mail címed a profilodban — e-mailes válaszadáshoz add meg a profilodban!'}
                      </span>
                    </div>
                  )}

                  {isResident && residentHasValidEmail && (inlineReplyChannel === 'email' || inlineReplyChannel === 'both') && (
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-900">
                      {isEn
                        ? `Email replies from recipients will go to your profile email: ${residentProfileEmail}`
                        : `A címzettek e-mailes válaszai erre a beállított címedre érkeznek: ${residentProfileEmail}`}
                    </div>
                  )}

                  <textarea
                    rows={3}
                    value={inlineReplyBody}
                    onChange={(e) => setInlineReplyBody(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && inlineReplyBody.trim() && !isSendingInlineReply) {
                        e.preventDefault();
                        handleSendInlineReply();
                      }
                    }}
                    placeholder={isEn ? 'Write your reply here... (Ctrl+Enter to send)' : 'Írd meg a válaszodat ide... (Ctrl+Enter küldés)'}
                    className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs leading-relaxed resize-y focus:outline-none focus:border-[#1E3A8A]"
                  />

                  {inlineReplyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {inlineReplyAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-gray-200 text-[11px] text-gray-800"
                        >
                          <Paperclip className="w-3 h-3 text-gray-500 shrink-0" />
                          <span className="font-semibold truncate max-w-[180px]">{att.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setInlineReplyAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                            className="p-0.5 text-gray-400 hover:text-red-600 cursor-pointer"
                            title={isEn ? 'Remove' : 'Eltávolítás'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 border border-gray-200 text-gray-700 text-[11px] font-bold cursor-pointer transition-colors">
                      <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>{t.mail_add_file_btn || (isEn ? 'Attach File' : 'Fájl csatolása')}</span>
                      <input
                        type="file"
                        multiple
                        accept={ALLOWED_ACCEPT_ATTR}
                        onChange={(e) => handlePickAttachments(e, setInlineReplyAttachments)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isSendingInlineReply || !inlineReplyBody.trim()}
                      onClick={handleSendInlineReply}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1e40af] shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingInlineReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>
                        {isSendingInlineReply
                          ? (isEn ? 'Sending...' : 'Küldés...')
                          : (isEn ? 'Send Reply' : 'Válasz elküldése')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {viewingNotification.archived || viewingNotification.dismissed ? (
                  <button
                    type="button"
                    onClick={() => handleUnarchiveItem(viewingNotification.id, true)}
                    className="px-3.5 py-2 bg-white hover:bg-blue-50 border border-blue-200 text-[#1E3A8A] rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span>{t.mail_restore_btn || (isEn ? "Restore" : "Visszaállítás")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleArchiveItem(viewingNotification.id, true)}
                    className="px-3.5 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{t.mail_archive_btn || (isEn ? "Archive" : "Archiválás")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteItem(viewingNotification.id, true)}
                  className="px-3.5 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.mail_delete_btn || (isEn ? "Delete" : "Törlés")}</span>
                </button>

                {/* 1-Click Forward Official Audit Opinion to All Residents (Managing KK only) */}
                {isAdmin &&
                  canManageAnyBuilding &&
                  viewingNotification.meta?.isOfficialOpinion && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = viewingNotification;
                        setViewingNotification(null);
                        setComposeTargetBuildingId(target.buildingId || activeBuilding?.id || 'all');
                        setComposeAudience('all');
                        setComposeSubject(
                          (isEn ? (target.titleEn || target.titleHu) : (target.titleHu || target.titleEn)) || ''
                        );
                        setComposeBody(
                          (isEn ? (target.messageEn || target.messageHu) : (target.messageHu || target.messageEn)) || ''
                        );
                        setComposeAttachments(Array.isArray(target.attachments) ? target.attachments : []);
                        setComposeStep(1);
                        setIsComposeOpen(true);
                      }}
                      className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isEn ? "Share with Owners" : "Kiküldés a lakóknak"}</span>
                    </button>
                  )}
              </div>

              <button
                type="button"
                onClick={() => setViewingNotification(null)}
                className="px-5 py-2 bg-[#1E3A8A] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-900 shadow-xs"
              >
                {isEn ? "Close" : "Bezárás"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 5: UNIVERSAL DIRECT COMPOSE / REPLY / FINANCIAL AUDITOR OPINION MODAL */}
      {isDirectComposeOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0">
                  {directReplyTarget ? <Reply className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display truncate">
                    {directReplyTarget
                      ? (isEn ? `Reply to ${directReplyTarget.actorName || directReplyTarget.actorEmail}` : `Válasz küldése: ${directReplyTarget.actorName || directReplyTarget.actorEmail}`)
                      : isResident && activeBuildingSzvbList.length === 0
                      ? (isEn ? 'Write to Common Representative (Management)' : 'Levél írása a Közös Képviseletnek')
                      : (isEn ? 'New Message' : 'Új levél írása')}
                  </h3>
                  {activeBuilding && (
                    <span className="text-[11px] text-gray-500 block truncate">
                      🏢 {activeBuilding.name}{isResident && currentUser?.flatNum ? ` • ${currentUser.flatNum}. ${isEn ? 'flat' : 'lakás'}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isSendingDirect}
                onClick={() => setIsDirectComposeOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Recipient Indicator / Selector */}
              {directReplyTarget ? (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                      {isEn ? 'Recipient' : 'Címzett'}
                    </span>
                    <span className="font-bold text-gray-900">
                      {directReplyTarget.actorName || directReplyTarget.actorEmail}
                    </span>
                  </div>
                  {(directReplyTarget.meta?.senderRoleLabelHu || directReplyTarget.meta?.senderRoleLabelEn) && (
                    <span className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[#1E3A8A] text-[10px] font-bold">
                      {isEn ? directReplyTarget.meta.senderRoleLabelEn : directReplyTarget.meta.senderRoleLabelHu}
                    </span>
                  )}
                </div>
              ) : isResident ? (
                activeBuildingSzvbList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                        {isEn ? 'Recipient' : 'Címzett'}
                      </span>
                      <span className="font-bold text-gray-900">
                        {isEn ? 'Common Representative (Building Management)' : 'Közös Képviselet (Házkezelés)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1.5">
                      {isEn ? 'Recipients' : 'Címzettek'} <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-1.5">
                      {/* 1. Common Representative (KK) checkbox */}
                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          directIncludeKk
                            ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                            : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={directIncludeKk}
                          onChange={(e) => setDirectIncludeKk(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A] cursor-pointer"
                        />
                        <Building2 className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-gray-900 block truncate">
                            {isEn ? 'Common Representative (Management)' : 'Közös Képviselet (KK)'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1E3A8A] shrink-0">
                          KK
                        </span>
                      </label>

                      {/* 2. Entire SZVB Committee checkbox (delivers to all SZVB members at once) */}
                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          directIncludeSzvb
                            ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                            : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={directIncludeSzvb}
                          onChange={(e) => setDirectIncludeSzvb(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-700 focus:ring-indigo-600 cursor-pointer"
                        />
                        <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-gray-900 block truncate">
                            {isEn ? 'Supervisory Committee (SZVB)' : 'Számvizsgáló Bizottság (SZVB)'}
                          </span>
                          <span className="text-[10px] text-gray-500 block truncate">
                            {isEn
                              ? `Sent to all ${activeBuildingSzvbList.length} committee members simultaneously`
                              : `A teljes SZVB tanács (${activeBuildingSzvbList.length} tag) egyszerre kapja meg`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                          SZVB ({activeBuildingSzvbList.length})
                        </span>
                      </label>
                    </div>
                    {!directIncludeKk && !directIncludeSzvb && (
                      <p className="text-[11px] font-semibold text-red-600 mt-1.5">
                        {isEn ? 'Select at least one recipient.' : 'Válassz ki legalább egy címzettet!'}
                      </p>
                    )}
                  </div>
                )
              ) : isAuditor ? (
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    {isEn ? 'Recipients' : 'Címzettek'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'kk_and_szvb', label: isEn ? 'Management + SZVB' : 'KK + SZVB együtt', disabled: false },
                      { id: 'kk', label: isEn ? 'Management (KK) Only' : 'Csak Közös Képviselet', disabled: false },
                      { id: 'szvb', label: isEn ? 'SZVB Only' : 'Csak SZVB', disabled: activeBuildingSzvbList.length === 0 },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => setDirectRecipientMode(opt.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          directRecipientMode === opt.id
                            ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isSzvb ? (
                <div>
                  <label className="block font-bold text-gray-700 mb-1.5">
                    {isEn ? 'Recipient' : 'Címzett'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'kk', label: isEn ? 'Management (KK)' : 'Közös Képviselet (KK)', disabled: false },
                      { id: 'auditor', label: isEn ? 'Financial Auditor' : 'Gazdasági ellenőr', disabled: !activeBuildingAuditor },
                      { id: 'kk_and_auditor', label: isEn ? 'Both (KK + Auditor)' : 'KK + Ellenőr együtt', disabled: !activeBuildingAuditor },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => setDirectRecipientMode(opt.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          directRecipientMode === opt.id
                            ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Delivery Channel Selector (In-App / Email / Both) for Resident, Financial Auditor & Replies */}
              {(isAuditor || isResident || Boolean(directReplyTarget)) && (
                <div className="space-y-2">
                  <label className="block font-bold text-gray-700">
                    {isEn ? 'Delivery Channel' : 'Kézbesítés módja'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'both', label: isEn ? 'Both (Email + In-App)' : 'Mindkettő (E-mail + App)', requiresEmail: true },
                      { id: 'in_app', label: isEn ? 'In-App Only' : 'Alkalmazáson belül', requiresEmail: false },
                      { id: 'email', label: isEn ? 'Email Only' : 'Csak e-mailben', requiresEmail: true },
                    ].map((ch) => {
                      const isDisabled = isResident && ch.requiresEmail && !residentHasValidEmail;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setDirectDeliveryChannel(ch.id)}
                          title={
                            isDisabled
                              ? (isEn ? 'Configure an email address in your profile first' : 'Előbb adj meg e-mail címet a profilodban')
                              : ch.label
                          }
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            directDeliveryChannel === ch.id
                              ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                  {isResident && !residentHasValidEmail && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {isEn
                          ? 'No email address is configured in your profile, so email sending is disabled. Add an email in your profile to enable it.'
                          : 'Nincs beállított e-mail címed a profilodban, ezért e-mailt jelenleg nem tudsz küldeni. Add meg a profilodban az e-mail címedet!'}
                      </span>
                    </div>
                  )}
                  {isResident && residentHasValidEmail && (directDeliveryChannel === 'email' || directDeliveryChannel === 'both') && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        {isEn
                          ? `Email replies from KK/SZVB will be delivered directly to: ${residentProfileEmail}`
                          : `Ha a KK vagy az SZVB e-mailben válaszol, a válasz közvetlenül erre a címedre érkezik: ${residentProfileEmail}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {t.comm_msg_subject || (isEn ? 'Subject' : 'Tárgy')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={directSubject}
                  onChange={(e) => setDirectSubject(e.target.value)}
                  placeholder={isEn ? 'Enter subject...' : 'Levél tárgya...'}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {t.comm_msg_body || (isEn ? 'Message' : 'Üzenet szövege')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={6}
                  value={directBody}
                  onChange={(e) => setDirectBody(e.target.value)}
                  placeholder={isEn ? 'Write your message here...' : 'Írd meg a leveled szövegét...'}
                  className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-xs leading-relaxed resize-y focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>

              {/* Document Attachments Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-bold text-gray-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>
                      {t.mail_attachments_label || (isEn ? 'Attach Documents (optional)' : 'Dokumentumok csatolása (opcionális)')}
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#1E3A8A] text-[11px] font-bold cursor-pointer transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.mail_add_file_btn || (isEn ? 'Attach File' : 'Fájl csatolása')}</span>
                    <input
                      type="file"
                      multiple
                      accept={ALLOWED_ACCEPT_ATTR}
                      onChange={(e) => handlePickAttachments(e, setDirectAttachments)}
                      className="hidden"
                    />
                  </label>
                </div>
                {directAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {directAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-800"
                      >
                        <Paperclip className="w-3 h-3 text-gray-500 shrink-0" />
                        <span className="font-semibold truncate max-w-[200px]">{att.fileName}</span>
                        {att.fileSize && <span className="text-[10px] text-gray-500">({att.fileSize})</span>}
                        <button
                          type="button"
                          onClick={() => setDirectAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                          className="p-0.5 text-gray-400 hover:text-red-600 cursor-pointer"
                          title={isEn ? 'Remove' : 'Eltávolítás'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isSendingDirect}
                onClick={() => setIsDirectComposeOpen(false)}
                className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isEn ? 'Cancel' : 'Mégse'}
              </button>
              <button
                type="button"
                disabled={
                  isSendingDirect ||
                  !directSubject.trim() ||
                  !directBody.trim() ||
                  (isResident && !directReplyTarget && activeBuildingSzvbList.length > 0 && !directIncludeKk && !directIncludeSzvb)
                }
                onClick={handleSendDirectMessage}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1e40af] shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingDirect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>
                  {isSendingDirect
                    ? (isEn ? 'Sending...' : 'Küldés...')
                    : (isEn ? 'Send Message' : 'Levél elküldése')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODAL 4: Standalone Dry Run Viewer */}
      {ruleDryRunTarget && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
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
                  disabled={isDispatchingRuleId === ruleDryRunTarget.id}
                  onClick={async () => {
                    const target = ruleDryRunTarget;
                    setRuleDryRunTarget(null);
                    await handleSimulateRuleDispatch(target, { sendReal: true });
                    setActiveTab('outbox');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isDispatchingRuleId === ruleDryRunTarget.id
                      ? (t.comm_dispatching || (isEn ? "Dispatching..." : "Kiküldés..."))
                      : (isEn ? "Dispatch to All Matching Units Now" : "Valódi kiküldés az érintett lakásoknak")}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
