/**
 * Action creators for email communication, automated dunning rules, direct resident notices, and outbox logs.
 */

import { 
  DEFAULT_DUNNING_RULES, 
  buildPaymentDetailsBlock, 
  resolveFlatOwnerName,
  resolveFlatOwnerRecipients,
  getBudapestTimeParts,
  parseDispatchTime,
  renderEmailTemplate,
  shouldRuleAutoDispatchToday,
  evaluateRulesForAutoDispatch
} from '../utils/dunningRules.js';
import { ref, set, get } from 'firebase/database';
import { getFirebaseInstance, IS_FIRESTORE_MODE } from '../constants/firebaseConfig.js';
import {
  uploadBase64ToStorage,
  getSecureStorageDownloadUrl,
  callSendDirectMail,
  saveBuildingEmailRule,
  deleteBuildingEmailRule,
  saveBuildingEmailOutboxItem,
  clearBuildingEmailOutbox,
} from '../services/firestoreService.js';
import { canUserManageBuilding, buildNotification } from '../utils/teamPermissions.js';
import { sanitizeMailAttachments, buildDirectMessagePayload, resolveResidentProfileEmail } from '../utils/directMessaging.js';
import { sendResidentCustomNoticeEmail, resolveEffectiveEmailSettings } from '../services/emailService.js';
import { getPermanentVault, savePermanentVault } from './syncEngine.js';
import { getServerNow, getServerIsoString } from '../utils/serverClock.js';

export function createEmailActions(optionsOrState, maybeSetState) {
  let state, setState, persistState, showToast, t;
  if (typeof maybeSetState === 'function') {
    state = optionsOrState;
    setState = maybeSetState;
  } else {
    ({ state, setState, persistState, showToast, t } = optionsOrState || {});
  }

  const getState = () => {
    if (typeof optionsOrState?.getState === 'function') return optionsOrState.getState();
    if (optionsOrState && typeof optionsOrState === 'object' && 'state' in optionsOrState) return optionsOrState.state;
    return state;
  };

  const isEn = () => (getState()?.currentLang === 'en');

  const checkManagePerm = (buildingId) => {
    const cur = getState();
    if (!cur?.currentUser) return false;
    // If specific building, check permission on that building
    if (buildingId && buildingId !== 'all') {
      return canUserManageBuilding(cur.currentUser, buildingId, cur.organizations, cur.buildings);
    }
    // If 'all', user must have permission on at least one or be owner/superadmin
    return canUserManageBuilding(cur.currentUser, null, cur.organizations, cur.buildings);
  };

  const saveEmailRule = (ruleData) => {
    if (!ruleData) return;
    const targetBld = ruleData.buildingId || 'all';
    if (!checkManagePerm(targetBld)) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "You have view-only access. Dunning rules cannot be modified." : "Csak megtekintési jogosultságod van. A felszólítási szabályok nem módosíthatók.", "error");
      }
      return false;
    }

    if (ruleData.id) {
      const currentVault = getPermanentVault();
      if (currentVault.deletedIds && currentVault.deletedIds.includes(ruleData.id)) {
        currentVault.deletedIds = currentVault.deletedIds.filter(x => x !== ruleData.id);
        savePermanentVault(currentVault);
      }
    }

    // Calculate Budapest server time to check if a schedule change falls in the past today
    const nowForSchedule = getServerNow();
    const { day: curScheduleDay, hour: curScheduleH, minute: curScheduleM, dateStr: todayScheduleStr } = getBudapestTimeParts(nowForSchedule);
    const curScheduleMinutes = curScheduleH * 60 + curScheduleM;
    const targetScheduleDay = Number(ruleData.checkDayOfMonth || 15);
    const targetScheduleTime = parseDispatchTime(ruleData.dispatchTime);
    const targetScheduleMinutes = targetScheduleTime.hour * 60 + targetScheduleTime.minute;
    const isTargetDayToday = targetScheduleDay === curScheduleDay;
    const isTargetTimePastToday = isTargetDayToday && curScheduleMinutes >= targetScheduleMinutes;

    // Clear today's local persistent lock ONLY if schedule was edited and new time has NOT already elapsed today
    try {
      if (typeof localStorage !== 'undefined' && ruleData.id) {
        if (!isTargetTimePastToday) {
          localStorage.removeItem(`tarsas_dunning_rule_${ruleData.id}_${todayScheduleStr}`);
        } else {
          localStorage.setItem(`tarsas_dunning_rule_${ruleData.id}_${todayScheduleStr}`, todayScheduleStr);
        }
      }
    } catch (e) {}

    let savedRuleForFirestore = null;
    const updater = (prev) => {
      const currentRules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
        ? prev.emailRules 
        : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
      const existingIdx = currentRules.findIndex((r) => r.id === ruleData.id);
      let updatedRules;
      if (existingIdx >= 0) {
        const oldRule = currentRules[existingIdx];
        const scheduleChanged = oldRule.dispatchTime !== ruleData.dispatchTime || 
                               oldRule.checkDayOfMonth !== ruleData.checkDayOfMonth ||
                               oldRule.enabled !== ruleData.enabled;

        let resolvedLastDispatched = oldRule.lastAutoDispatchedDate || null;
        if (scheduleChanged) {
          resolvedLastDispatched = isTargetTimePastToday ? todayScheduleStr : null;
        }

        const mergedRule = {
          ...oldRule,
          ...ruleData,
          lastAutoDispatchedDate: resolvedLastDispatched,
          updatedAt: getServerIsoString()
        };
        savedRuleForFirestore = mergedRule;
        updatedRules = currentRules.map((r, idx) => (idx === existingIdx ? mergedRule : r));
      } else {
        const newRule = {
          ...ruleData,
          id: ruleData.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          lastAutoDispatchedDate: isTargetTimePastToday ? todayScheduleStr : null,
          createdAt: getServerIsoString()
        };
        savedRuleForFirestore = newRule;
        updatedRules = [newRule, ...currentRules];
      }
      if (IS_FIRESTORE_MODE && savedRuleForFirestore) {
        const fsBId = prev.currentBuildingId || prev.buildings?.[0]?.id;
        if (fsBId) saveBuildingEmailRule(fsBId, savedRuleForFirestore.id, savedRuleForFirestore).catch(() => {});
      }
      return {
        ...prev,
        emailRules: updatedRules,
        vault: {
          ...(prev.vault || {}),
          deletedIds: ((prev.vault?.deletedIds) || []).filter(x => x !== ruleData.id),
          lastUpdated: Date.now()
        },
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
    return true;
  };

  const deleteEmailRule = (ruleId) => {
    if (!ruleId) return;
    const currentRules = Array.isArray(state?.emailRules) ? state.emailRules : [];
    const rule = currentRules.find(r => r.id === ruleId);
    if (!checkManagePerm(rule?.buildingId || 'all')) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "You have view-only access. Dunning rules cannot be modified." : "Csak megtekintési jogosultságod van. A felszólítási szabályok nem módosíthatók.", "error");
      }
      return false;
    }

    // Register tombstone in permanent vault so other browsers/sessions never resurrect it
    const vault = getPermanentVault();
    vault.deletedIds = vault.deletedIds || [];
    if (!vault.deletedIds.includes(ruleId)) {
      vault.deletedIds.push(ruleId);
      savePermanentVault(vault);
    }

    const updater = (prev) => {
      const rules = Array.isArray(prev.emailRules) ? prev.emailRules : [];
      if (IS_FIRESTORE_MODE) {
        const fsBId = prev.currentBuildingId || prev.buildings?.[0]?.id;
        if (fsBId) deleteBuildingEmailRule(fsBId, ruleId).catch(() => {});
      }
      return {
        ...prev,
        emailRules: rules.filter((r) => r.id !== ruleId),
        vault: {
          ...(prev.vault || {}),
          deletedIds: Array.from(new Set([...(prev.vault?.deletedIds || []), ruleId])),
          lastUpdated: Date.now()
        },
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
    return true;
  };

  const toggleEmailRule = (ruleId) => {
    if (!ruleId) return;
    const currentRules = Array.isArray(state?.emailRules) && state.emailRules.length > 0 
      ? state.emailRules 
      : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
    const rule = currentRules.find(r => r.id === ruleId);
    if (!checkManagePerm(rule?.buildingId || 'all')) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "You have view-only access. Dunning rules cannot be modified." : "Csak megtekintési jogosultságod van. A felszólítási szabályok nem módosíthatók.", "error");
      }
      return false;
    }

    const updater = (prev) => {
      const rules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
        ? prev.emailRules 
        : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
      let toggled = null;
      const nextRules = rules.map((r) => {
        if (r.id === ruleId) {
          toggled = { ...r, enabled: !r.enabled };
          return toggled;
        }
        return r;
      });
      if (IS_FIRESTORE_MODE && toggled) {
        const fsBId = prev.currentBuildingId || prev.buildings?.[0]?.id;
        if (fsBId) saveBuildingEmailRule(fsBId, toggled.id, toggled).catch(() => {});
      }
      return {
        ...prev,
        emailRules: nextRules,
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
    return true;
  };

  const queueOutboxItems = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const updater = (prev) => {
      const currentOutbox = Array.isArray(prev.emailOutbox) ? prev.emailOutbox : [];
      const newItems = items.map((it) => ({
        ...it,
        id: it.id || `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: it.status || 'simulated',
        queuedAt: getServerIsoString()
      }));
      if (IS_FIRESTORE_MODE) {
        const fsBId = prev.currentBuildingId || prev.buildings?.[0]?.id;
        if (fsBId) {
          newItems.forEach((it) => saveBuildingEmailOutboxItem(fsBId, it.id, it).catch(() => {}));
        }
      }
      return {
        ...prev,
        emailOutbox: [...newItems, ...currentOutbox].slice(0, 500),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
  };

  const clearOutboxItems = (buildingId) => {
    if (!checkManagePerm(buildingId || 'all')) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "You have view-only access." : "Csak megtekintési jogosultságod van.", "error");
      }
      return false;
    }
    const updater = (prev) => {
      if (IS_FIRESTORE_MODE) {
        const fsBId = (buildingId && buildingId !== 'all' ? buildingId : null) || prev.currentBuildingId || prev.buildings?.[0]?.id;
        if (fsBId) clearBuildingEmailOutbox(fsBId).catch(() => {});
      }
      return {
        ...prev,
        emailOutbox: [],
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
    return true;
  };

  /**
   * Uploads mail attachments once to cloud storage (RTDB condo_doc_files/mail or Firebase Storage)
   * and returns lightweight sanitized metadata objects safe to embed in notifications & outbox logs.
   */
  const uploadMailAttachments = async (buildingId, rawAttachments = []) => {
    if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) return [];
    const safeList = sanitizeMailAttachments(rawAttachments);
    const enriched = await Promise.all(
      safeList.map(async (meta, idx) => {
        const raw = rawAttachments[idx];
        const fileData = typeof raw?.fileData === 'string' ? raw.fileData : (typeof raw?.inlineData === 'string' ? raw.inlineData : '');
        if (!fileData) return meta;
        if (IS_FIRESTORE_MODE) {
          try {
            const storagePath = `buildings/${buildingId || 'general'}/mail/${meta.id}/${meta.fileName}`;
            await uploadBase64ToStorage(storagePath, fileData, meta.mimeType || 'application/octet-stream');
            return { ...meta, storagePath, hasCloudFile: true };
          } catch (err) {
            console.warn('Firestore mail attachment upload warning:', err?.message);
            return meta;
          }
        }
        try {
          const { db } = getFirebaseInstance();
          if (db) {
            await set(ref(db, meta.storageKey), {
              fileName: meta.fileName,
              fileType: meta.fileType,
              mimeType: meta.mimeType,
              fileData,
              uploadedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('RTDB mail attachment upload warning:', err?.message);
        }
        return { ...meta, hasCloudFile: true };
      })
    );
    return enriched;
  };

  /**
   * Fetches downloadable data URL or signed Storage URL for a mail attachment.
   */
  const fetchMailAttachment = async (attachment) => {
    if (!attachment) return null;
    if (attachment.inlineData) return attachment.inlineData;
    if (IS_FIRESTORE_MODE && attachment.storagePath) {
      try {
        return await getSecureStorageDownloadUrl(attachment.storagePath);
      } catch (err) {
        console.warn('Could not fetch Firestore mail attachment:', err?.message);
      }
    }
    if (!IS_FIRESTORE_MODE && attachment.storageKey) {
      try {
        const { db } = getFirebaseInstance();
        if (db) {
          const snap = await get(ref(db, attachment.storageKey));
          if (snap.exists() && snap.val()?.fileData) {
            return snap.val().fileData;
          }
        }
      } catch (err) {
        console.warn('Could not fetch RTDB mail attachment:', err?.message);
      }
    }
    return null;
  };

  /**
   * Broadcasts / sends a direct resident notice letter to targeted recipients
   * with delivery via transactional email and/or in-app notification bell, plus optional attachments.
   */
  const sendCustomResidentNotice = async ({
    buildingId,
    recipients = [],
    subject = '',
    body = '',
    category = 'general',
    sendEmail = true,
    sendInAppNotification = true,
    attachments = [],
  }) => {
    if (!buildingId || !checkManagePerm(buildingId)) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "You have view-only access. Composing notices is disabled." : "Csak megtekintési jogosultságod van. Levélküldéshez kezelői jog szükséges.", "error");
      }
      return { success: false, error: 'permission-denied' };
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "No recipients selected!" : "Nincs kiválasztva címzett!", "warning");
      }
      return { success: false, error: 'no-recipients' };
    }

    if (!subject.trim() || !body.trim()) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? "Subject and message body are required!" : "A levél tárgya és szövege kötelező!", "warning");
      }
      return { success: false, error: 'missing-content' };
    }

    const uploadedAttachments = await uploadMailAttachments(buildingId, attachments);
    const defaultBld = buildingId !== 'all' ? ((state?.buildings || []).find((b) => b.id === buildingId) || null) : null;

    const newNotifications = [];
    const newOutboxEntries = [];

    await Promise.all(recipients.map(async (r) => {
      const rBuilding = (state?.buildings || []).find((b) => b.id === (r.buildingId || buildingId)) || defaultBld;
      const bldName = rBuilding?.officialName || rBuilding?.name || r.buildingName || (isEn() ? 'Condominium' : 'Társasház');
      const bldId = r.buildingId || buildingId || rBuilding?.id || 'general';

      // Find specific flat in building state if available for rich debt details
      const rFlat = (rBuilding?.flats || []).find(f => String(f.flatNum) === String(r.flatNum)) || {
        flatNum: r.flatNum,
        balance: r.balance
      };

      const paymentDetails = buildPaymentDetailsBlock(rFlat, rBuilding, { isEn: isEn() });
      const now = getServerNow();
      const dueDate = new Date(now.getTime() + (8 * 24 * 60 * 60 * 1000));
      const dueDateFormatted = isEn()
        ? dueDate.toLocaleDateString('en-GB')
        : `${dueDate.getFullYear()}. ${String(dueDate.getMonth() + 1).padStart(2, '0')}. ${String(dueDate.getDate()).padStart(2, '0')}.`;

      const resolvedOwner = r.name || resolveFlatOwnerName(rFlat, isEn());
      const compositeOwners = resolveFlatOwnerName(rFlat, isEn());

      // Personalize body for tags
      const personalizedBody = body
        .replace(/\{lakasTulajdonosa\}|\{flatOwner\}|\{tulajdonosNeve\}|\{ownerName\}|\{\{\s*lakas_tulajdonosa\s*\}\}|\{\{\s*flat_owner\s*\}\}|\{\{\s*tulajdonos_neve\s*\}\}|\{\{\s*owner_name\s*\}\}/gi, resolvedOwner)
        .replace(/\{osszesTulajdonos\}|\{allOwners\}|\{\{\s*osszes_tulajdonos\s*\}\}|\{\{\s*all_owners\s*\}\}/gi, compositeOwners)
        .replace(/\{lakasszam\}|\{flatNum\}|\{\{\s*lakas_szam\s*\}\}|\{\{\s*flat_num\s*\}\}/gi, r.flatNum || '')
        .replace(/\{tarsashazNeve\}|\{buildingName\}|\{\{\s*tarsashaz_neve\s*\}\}|\{\{\s*building_name\s*\}\}/gi, bldName)
        .replace(/\{aktualisEgyenleg\}|\{egyenleg\}|\{balance\}|\{\{\s*hatralek_osszeg\s*\}\}|\{\{\s*arrears_amount\s*\}\}/gi, r.balanceFormatted || '')
        .replace(/\{fizetesiAdatok\}|\{paymentDetails\}|\{\{\s*fizetesi_adatok\s*\}\}|\{\{\s*payment_details\s*\}\}/gi, paymentDetails)
        .replace(/\{fizetesiHatarido\}|\{dueDate\}|\{\{\s*fizetesi_hatarido\s*\}\}|\{\{\s*due_date\s*\}\}/gi, dueDateFormatted)
        .replace(/\{kepviseloNeve\}|\{managerName\}|\{\{\s*kepviselo_neve\s*\}\}|\{\{\s*manager_name\s*\}\}/gi, rBuilding?.managerContact?.name || state?.repProfile?.name || state?.currentUser?.name || '')
        .replace(/\{cegNeve\}|\{companyName\}|\{\{\s*ceg_neve\s*\}\}|\{\{\s*company_name\s*\}\}/gi, state?.repProfile?.companyName || '');

      // 1. In-app notification
      if (sendInAppNotification) {
        const targetProf = r.targetProfile || {
          type: r.isAuditor ? 'auditor' : 'owner',
          buildingId: bldId || null,
          flatNum: r.flatNum || null,
        };
        newNotifications.push(
          buildNotification({
            type: category || 'info',
            severity: category === 'urgent' ? 'critical' : category === 'finance' ? 'warning' : 'info',
            recipientEmail: r.email || '',
            recipientScope: r.isAuditor ? 'auditor' : 'flat',
            buildingId: bldId,
            buildingName: bldName,
            flatNum: r.flatNum || null,
            targetProfile: targetProf,
            actorUser: state.currentUser,
            titleHu: subject,
            titleEn: subject,
            messageHu: personalizedBody,
            messageEn: personalizedBody,
            attachments: uploadedAttachments,
            meta: {
              senderRole: state.currentUser?.role || 'admin',
              senderProfile: { type: 'kk', buildingId: bldId || null },
              senderRoleLabelHu: 'Közös Képviselet',
              senderRoleLabelEn: 'Management (KK)',
            },
          })
        );
      }

      // 2. Dispatch transactional email
      let emailStatus = sendEmail && r.email ? 'queued' : 'in-app-only';
      let emailErrorMessage = null;
      let emailWasSent = false;

      if (sendEmail && r.email) {
        try {
          const sendRes = await sendResidentCustomNoticeEmail({
            recipientEmail: r.email,
            recipientName: r.name,
            flatNum: r.flatNum,
            subject,
            messageBody: personalizedBody,
            category,
            targetBuilding: rBuilding,
            repProfile: state?.repProfile || {},
            organizations: state?.organizations || [],
            senderUser: state?.currentUser,
            isEn: isEn(),
            emailSettings: rBuilding?.emailSettings || state?.emailSettings || {},
          });

          if (sendRes && sendRes.success) {
            emailStatus = 'sent';
            emailWasSent = true;
          } else {
            emailStatus = 'failed';
            emailErrorMessage = sendRes?.message || 'E-mail küldési hiba';
          }
        } catch (err) {
          emailStatus = 'failed';
          emailErrorMessage = err?.message || 'Hálózati hiba a levélküldéskor';
        }
      }

      // 3. Outbox log entry for representative
      newOutboxEntries.push({
        id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        buildingId: bldId,
        buildingName: bldName,
        flatNum: r.flatNum,
        recipientName: r.name,
        recipientEmail: r.email || '',
        ruleId: 'manual-notice',
        ruleName: isEn() ? 'Direct Notice' : 'Közvetlen tájékoztató',
        subject,
        body: personalizedBody,
        category,
        attachments: uploadedAttachments,
        debt: r.balance,
        status: emailStatus,
        errorMessage: emailErrorMessage,
        sendEmail,
        sendInApp: sendInAppNotification,
        queuedAt: getServerIsoString(),
        sentAt: emailWasSent ? getServerIsoString() : undefined,
      });
    }));

    const updater = (prev) => {
      const curOutbox = Array.isArray(prev.emailOutbox) ? prev.emailOutbox : [];
      const curNotifs = Array.isArray(prev.notifications) ? prev.notifications : [];
      return {
        ...prev,
        emailOutbox: [...newOutboxEntries, ...curOutbox].slice(0, 500),
        notifications: [...newNotifications, ...curNotifs].slice(0, 300),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1,
      };
    };

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }

    const failedItems = newOutboxEntries.filter(it => it.status === 'failed');
    if (failedItems.length > 0 && typeof showToast === 'function') {
      const firstErr = failedItems[0]?.errorMessage || '';
      const isSandboxIssue = firstErr.includes('only send testing emails') || firstErr.includes('verify a domain');
      if (isSandboxIssue) {
        showToast(
          isEn()
            ? "Notice logged, but Resend in testing sandbox mode only delivers to your registered account email. Verify a domain at resend.com/domains to send to all residents."
            : "A levél rögzítve lett, de a Resend teszt módban csak a regisztrált fejlesztői e-mailre kézbesít. Bármilyen lakónak küldéshez domain hitelesítés szükséges a resend.com oldalon!",
          "warning"
        );
      } else {
        showToast(
          isEn()
            ? `Notice queued, but email delivery failed: ${firstErr}`
            : `A levél naplózva lett, de az e-mail kézbesítés sikertelen: ${firstErr}`,
          "warning"
        );
      }
    } else if (typeof showToast === 'function') {
      showToast(
        isEn()
          ? `Notice successfully sent to ${recipients.length} recipients!`
          : `Levél sikeresen elküldve ${recipients.length} címzettnek!`,
        "success"
      );
    }

    return { success: true, count: recipients.length, failedCount: failedItems.length };
  };

  let isAutoDunningChecking = false;
  let lastAutoDunningCheckTimestamp = 0;

  const executeAutomatedDunningDailyCheck = async (options = {}) => {
    // 1. In-memory mutex & rate-limit check (cannot run concurrently or within 30s)
    if (isAutoDunningChecking && !options.testDate && !options.forceRuleId) {
      return { ran: false, reason: 'already-checking' };
    }
    const nowMs = Date.now();
    if (!options.testDate && !options.forceRuleId && nowMs - lastAutoDunningCheckTimestamp < 30000) {
      return { ran: false, reason: 'rate-limited' };
    }

    isAutoDunningChecking = true;
    lastAutoDunningCheckTimestamp = nowMs;

    try {
      const curState = getState();
      if (!curState?.currentUser) return { ran: false, reason: 'no-user' };

      // Permission check: only users who can manage buildings can execute dunning actions
      if (!checkManagePerm('all')) {
        return { ran: false, reason: 'unauthorized' };
      }

      const currentRules = Array.isArray(curState?.emailRules) && curState.emailRules.length > 0
        ? curState.emailRules
        : DEFAULT_DUNNING_RULES;

      let effectiveDueResults = [];

      if (options.forceRuleId) {
        const targetRule = currentRules.find(r => r.id === options.forceRuleId);
        if (!targetRule) {
          return { ran: false, reason: 'rule-not-found' };
        }
        const now = options.testDate || getServerNow();
        const { dateStr } = getBudapestTimeParts(now);
        const matches = runDunningDryRun(targetRule, curState.buildings || [], {}, {
          isEn: isEn(),
          repProfile: curState.repProfile,
          currentDate: now,
          history: curState.emailOutbox || []
        });
        if (matches.length === 0) {
          return { ran: false, reason: 'no-matching-flats' };
        }
        effectiveDueResults = [{ rule: targetRule, dateStr, matches }];
      } else {
        const evaluation = evaluateRulesForAutoDispatch(
          currentRules,
          curState.buildings || [],
          {
            isEn: isEn(),
            repProfile: curState.repProfile,
            currentDate: options.testDate || getServerNow(),
            history: curState.emailOutbox || []
          }
        );

        if (!evaluation.shouldRun) {
          return { ran: false, ...evaluation };
        }

        // 2. Persistent LocalStorage Lock per rule: ensures even if cloud sync overwrites in-memory state,
        // a rule NEVER fires more than once per calendar day in this browser!
        effectiveDueResults = evaluation.resultsByRule.filter(({ rule, dateStr }) => {
          try {
            if (typeof localStorage !== 'undefined' && !options.testDate) {
              const ruleLock = localStorage.getItem(`tarsas_dunning_rule_${rule.id}_${dateStr}`);
              if (ruleLock === dateStr) return false;
            }
          } catch (e) {}
          return true;
        });

        if (effectiveDueResults.length === 0) {
          return { ran: false, reason: 'already-dispatched-today-local' };
        }
      }

      const newOutboxEntries = [];
      const newNotifications = [];
      const updatedRuleMarkers = {};
      let totalEmailsSent = 0;

      const emailSettings = resolveEffectiveEmailSettings(curState.globalSettings?.emailSettings || curState.repProfile?.emailSettings);

      for (const { rule, dateStr, matches } of effectiveDueResults) {
        const shouldSendEmail = rule.sendEmail !== false;
        const shouldSendInApp = rule.sendInApp !== false;
        let sentCountForRule = 0;

        // Immediately set local persistent lock
        try {
          if (typeof localStorage !== 'undefined' && !options.testDate) {
            localStorage.setItem(`tarsas_dunning_rule_${rule.id}_${dateStr}`, dateStr);
          }
        } catch (e) {}

        for (const m of matches) {
          const bld = (curState.buildings || []).find(b => b.id === m.buildingId);
          const flat = (bld?.flats || []).find(f => String(f.flatNum) === String(m.flatNum));
          const ownerRecs = (Array.isArray(m.ownerRecipients) && m.ownerRecipients.length > 0)
            ? m.ownerRecipients
            : resolveFlatOwnerRecipients(flat || { flatNum: m.flatNum, ownerName: m.ownerName, email: m.ownerEmail }, { isEn: isEn() });

          const effectiveRecipients = ownerRecs.length > 0
            ? ownerRecs
            : [{ name: m.ownerName, email: m.ownerEmail, sendEmailNotification: true }];

          for (const rec of effectiveRecipients) {
            const ownerName = rec.name || m.ownerName;
            const ownerEmail = (rec.email || '').trim();
            const hasValidEmail = Boolean(ownerEmail && ownerEmail.includes('@'));
            const canSendEmailToThisOwner = shouldSendEmail && hasValidEmail && (rec.sendEmailNotification !== false);

            // 3. Flat + Owner level deduplication: check if this specific owner already received notice today
            const alreadySentToday = (curState.emailOutbox || []).some(o => {
              if (!o) return false;
              if (o.status !== 'sent') return false;
              const oDate = (o.sentAt || o.queuedAt || '').slice(0, 10);
              if (oDate !== dateStr) return false;
              const sameBuilding = (!o.buildingId && !m.buildingId) || String(o.buildingId || '') === String(m.buildingId || '');
              const sameFlat = String(o.flatNum || '') === String(m.flatNum || '');
              const sameEmail = Boolean(ownerEmail && o.recipientEmail && o.recipientEmail.toLowerCase() === ownerEmail.toLowerCase());
              return (sameBuilding && sameFlat && sameEmail);
            }) || newOutboxEntries.some(o => {
              if (o.status !== 'sent') return false;
              const sameBuilding = (!o.buildingId && !m.buildingId) || String(o.buildingId || '') === String(m.buildingId || '');
              const sameFlat = String(o.flatNum || '') === String(m.flatNum || '');
              const sameEmail = Boolean(ownerEmail && o.recipientEmail && o.recipientEmail.toLowerCase() === ownerEmail.toLowerCase());
              return (sameBuilding && sameFlat && sameEmail);
            });

            // Block duplicate sending only if already successfully sent today, unless explicitly forced
            if (alreadySentToday && !options.testDate && !options.forceRuleId) {
              continue;
            }

            // Personalize subject and body for this individual owner
            const ownerContext = {
              ...m.context,
              lakas_tulajdonosa: ownerName,
              lakasTulajdonosa: ownerName,
              flat_owner: ownerName,
              flatOwner: ownerName,
              tulajdonos_neve: ownerName,
              owner_name: ownerName,
              tulajdonosNeve: ownerName,
              ownerName: ownerName,
              osszes_tulajdonos: m.ownerName,
              all_owners: m.ownerName,
              osszesTulajdonos: m.ownerName,
              allOwners: m.ownerName
            };

            const subjTpl = isEn() && rule.templateSubjectEn ? rule.templateSubjectEn : rule.templateSubject;
            const bodyTpl = isEn() && rule.templateBodyEn ? rule.templateBodyEn : rule.templateBody;
            const renderedSubject = subjTpl ? renderEmailTemplate(subjTpl, ownerContext) : m.renderedSubject;
            const renderedBody = bodyTpl ? renderEmailTemplate(bodyTpl, ownerContext) : m.renderedBody;

            let wasSent = false;

            if (canSendEmailToThisOwner && emailSettings.isConfigured && !options.dryRunOnly) {
              try {
                const sendResult = await sendResidentCustomNoticeEmail({
                  recipientEmail: ownerEmail,
                  recipientName: ownerName,
                  flatNum: m.flatNum,
                  subject: renderedSubject,
                  messageBody: renderedBody,
                  category: 'finance',
                  targetBuilding: bld,
                  repProfile: curState?.repProfile || {},
                  organizations: curState?.organizations || [],
                  senderUser: curState?.currentUser,
                  isEn: isEn(),
                  emailSettings: bld?.emailSettings || curState?.emailSettings || emailSettings,
                });
                wasSent = Boolean(sendResult?.success);
              } catch (err) {
                console.warn('[autoDunningDispatch] Failed to send email to', ownerEmail, err?.message);
              }
            }

            if (wasSent) {
              sentCountForRule++;
              totalEmailsSent++;
            }

            // Determine outbox delivery status
            let outboxStatus = 'simulated';
            if (shouldSendEmail) {
              if (wasSent) outboxStatus = 'sent';
              else if (hasValidEmail && !emailSettings.isConfigured) outboxStatus = 'queued';
              else if (!hasValidEmail || rec.sendEmailNotification === false) outboxStatus = shouldSendInApp ? 'in-app-only' : 'failed';
              else outboxStatus = 'failed';
            } else {
              outboxStatus = 'in-app-only';
            }

            // Add outbox log entry for this owner
            newOutboxEntries.push({
              id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              ruleId: rule.id,
              ruleName: isEn() ? (rule.nameEn || rule.name) : rule.name,
              buildingId: m.buildingId,
              buildingName: m.buildingName,
              flatNum: m.flatNum,
              recipientName: ownerName,
              recipientEmail: ownerEmail || (isEn() ? "No email provided" : "Nincs e-mail"),
              subject: renderedSubject,
              body: renderedBody,
              debt: m.balance,
              arrearsMonths: m.arrearsMonths,
              status: outboxStatus,
              sendEmail: shouldSendEmail,
              sendInApp: shouldSendInApp,
              autoDispatched: true,
              queuedAt: getServerIsoString(),
              sentAt: wasSent ? getServerIsoString() : undefined,
            });

            // Add in-app notification only if in-app delivery is enabled
            if (shouldSendInApp) {
              newNotifications.push(
                buildNotification({
                  type: 'finance',
                  severity: 'warning',
                  recipientEmail: ownerEmail || '',
                  recipientScope: 'flat',
                  buildingId: m.buildingId,
                  buildingName: m.buildingName,
                  flatNum: m.flatNum || null,
                  targetProfile: {
                    type: 'owner',
                    buildingId: m.buildingId || null,
                    flatNum: m.flatNum || null,
                  },
                  actorUser: curState.currentUser,
                  titleHu: renderedSubject,
                  titleEn: renderedSubject,
                  messageHu: renderedBody,
                  messageEn: renderedBody,
                })
              );
            }
          }
        }

        updatedRuleMarkers[rule.id] = {
          lastAutoDispatchedDate: dateStr,
          lastAutoDispatchedAt: getServerIsoString(),
          lastAutoDispatchedCount: sentCountForRule
        };
      }

      // Persist updated rules, outbox and clean up any past duplicate notifications
      const updater = (prev) => {
        const rules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
          ? prev.emailRules 
          : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));

        const updatedRules = rules.map(r => {
          if (updatedRuleMarkers[r.id]) {
            return { ...r, ...updatedRuleMarkers[r.id] };
          }
          return r;
        });

        const curOutbox = Array.isArray(prev.emailOutbox) ? prev.emailOutbox : [];
        const curNotifs = Array.isArray(prev.notifications) ? prev.notifications : [];

        // Deduplicate existing notifications so duplicate spam is permanently pruned
        const seenCleanKeys = new Set();
        const cleanedExistingNotifs = [...newNotifications, ...curNotifs].filter(n => {
          if (!n) return false;
          const dayStr = (n.createdAt || '').slice(0, 10);
          const key = `${n.type || 'info'}_${n.buildingId || ''}_${n.titleHu || n.titleEn || ''}_${n.recipientEmail || ''}_${dayStr}`;
          if (seenCleanKeys.has(key)) return false;
          seenCleanKeys.add(key);
          return true;
        });

        return {
          ...prev,
          emailRules: updatedRules,
          emailOutbox: [...newOutboxEntries, ...curOutbox].slice(0, 500),
          notifications: cleanedExistingNotifs.slice(0, 300),
          lastUpdated: Date.now(),
          revision: (prev.revision || 0) + 1
        };
      };

      if (typeof persistState === 'function') {
        persistState(updater, true);
      } else if (typeof setState === 'function') {
        setState(updater);
      }

      if (totalEmailsSent > 0 && typeof showToast === 'function') {
        showToast(
          t?.comm_rule_auto_dispatched_toast
            ? t.comm_rule_auto_dispatched_toast.replace('{count}', totalEmailsSent)
            : (isEn() ? `Automated 8:00 AM dispatch sent ${totalEmailsSent} emails!` : `Az automatikus reggel 8:00-i kiküldés elküldött ${totalEmailsSent} db e-mailt!`),
          'info'
        );
      }

      return {
        ran: true,
        totalEmailsSent,
        processedRulesCount: effectiveDueResults.length,
        outboxEntriesCount: newOutboxEntries.length
      };
    } finally {
      isAutoDunningChecking = false;
    }
  };

  /**
   * Sends a role-validated direct message (with optional document attachments & optional Official Audit Opinion sync):
   *  - Resident -> Managing KK and/or entire SZVB committee (Reply-To: resident, CC: other SZVB members; Auditor & other Residents strictly forbidden)
   *  - SZVB -> Managing KK, active Financial Auditor, and/or All Residents (individual/BCC private delivery bypassing KK)
   *  - Financial Auditor -> Managing KK and/or SZVB ONLY (Residents strictly forbidden!)
   *  - Managing KK -> Residents, SZVB, or Financial Auditor on managed buildings
   */
  const sendDirectMessage = async ({
    buildingId,
    recipientMode = 'kk',
    includeKk = true,
    includeSzvb = false,
    includeAuditor = false,
    includeResidents = false,
    selectedSzvbEmails = [],
    replyToNotif = null,
    subject = '',
    body = '',
    category = 'general',
    attachments = [],
    auditOpinionMeta = null,
    sendInApp = true,
    sendEmail = false,
  } = {}) => {
    const cur = getState();
    const actorUser = cur?.currentUser;
    if (!actorUser) return { success: false, error: 'unauthenticated' };

    if (!sendInApp && !sendEmail) {
      if (typeof showToast === 'function') {
        showToast(
          isEn()
            ? 'Please select at least one delivery channel (In-App or Email).'
            : 'Kérjük, válassz legalább egy kézbesítési csatornát (Alkalmazáson belül vagy E-mail)!',
          'error'
        );
      }
      return { success: false, error: 'no-channel' };
    }

    const targetBId = buildingId || replyToNotif?.buildingId || cur.currentBuildingId || actorUser.buildingId || cur.buildings?.[0]?.id;
    const building = (cur.buildings || []).find((b) => b.id === targetBId);
    if (!building) {
      if (typeof showToast === 'function') {
        showToast(isEn() ? 'No condominium selected.' : 'Nincs kiválasztott társasház.', 'error');
      }
      return { success: false, error: 'missing-building' };
    }

    const deliveryChannel = sendEmail && sendInApp ? 'both' : sendEmail ? 'email' : 'in_app';
    const uploadedAttachments = await uploadMailAttachments(building.id, attachments);

    // Ensure actorUser carries a clean human display name (e.g. from building.economicAuditor / szvb / flat)
    const enrichedActor = {
      ...actorUser,
      name:
        actorUser.name ||
        (actorUser.role === 'auditor' ? building.economicAuditor?.name : '') ||
        actorUser.email ||
        '',
    };

    const payload = buildDirectMessagePayload({
      actorUser: enrichedActor,
      building,
      organizations: cur.organizations || [],
      users: cur.users || [],
      buildings: cur.buildings || [],
      recipientMode,
      includeKk,
      includeSzvb,
      includeAuditor,
      includeResidents,
      selectedSzvbEmails,
      replyToNotif,
      subject,
      body,
      category,
      attachments: uploadedAttachments,
      auditOpinionMeta,
      deliveryChannel,
    });

    if (!payload.ok) {
      if (typeof showToast === 'function') {
        const msgMap = {
          'permission-denied': isEn()
            ? 'You do not have permission to send messages from this profile.'
            : 'Nincs jogosultságod üzenetet küldeni ebből a profilból.',
          'sender-email-required': isEn()
            ? 'Please configure a valid email address in your profile before sending emails.'
            : 'E-mail küldéséhez előbb adj meg egy érvényes e-mail címet a profilodban!',
          'resident-kk-only': isEn()
            ? 'Residents can only send direct messages to the Common Representative (Management) or SZVB.'
            : 'Lakói profilból kizárólag a Közös Képviselet vagy az SZVB részére küldhető levél.',
          'resident-kk-szvb-only': isEn()
            ? 'Residents can only send direct messages to the Common Representative (Management) or SZVB.'
            : 'Lakói profilból kizárólag a Közös Képviselet vagy az SZVB részére küldhető levél.',
          'auditor-kk-szvb-only': isEn()
            ? 'Financial Auditors may only message Management (KK) or SZVB (never directly to Residents).'
            : 'A gazdasági ellenőr kizárólag a Közös Képviseletnek vagy az SZVB-nak írhat (lakóknak közvetlenül nem).',
          'no-recipients': isEn()
            ? 'No recipient with a valid email address was found for the selected target.'
            : 'A kiválasztott címzetthez nem található érvényes e-mail cím a rendszerben.',
          'missing-content': isEn()
            ? 'Subject and message body are required.'
            : 'A levél tárgya és szövege kötelező!',
        };
        showToast(msgMap[payload.error] || (isEn() ? 'Failed to send message.' : 'Nem sikerült elküldeni a levelet.'), 'error');
      }
      return { success: false, error: payload.error };
    }

    // Dispatch real emails when Email channel ('email' or 'both') is selected
    let emailsSent = 0;
    let emailsFailed = 0;
    let firstEmailError = '';
    if (sendEmail) {
      const isAdminSender = enrichedActor?.role === 'admin' || enrichedActor?.role === 'superadmin';
      const isSzvbSender = enrichedActor?.role === 'szvb';
      const isResidentSender = !isAdminSender && !isSzvbSender && enrichedActor?.role !== 'auditor';

      const senderEmailForReply = !isAdminSender
        ? (resolveResidentProfileEmail(enrichedActor, building) || enrichedActor?.email || '')
        : '';
      const senderLabel = isEn()
        ? (payload.senderCopyNotification?.meta?.senderRoleLabelEn || '')
        : (payload.senderCopyNotification?.meta?.senderRoleLabelHu || '');
      const emailHeaderTitle = isSzvbSender
        ? (isEn()
            ? `Supervisory Committee (SZVB) Notice — ${building.name || 'Condominium'}`
            : `SZVB Közlemény — ${building.name || 'Társasház'}`)
        : !isAdminSender
        ? (isEn()
            ? `Condominium Message — ${building.name || 'Condominium'}`
            : `Társasházi üzenet — ${building.name || 'Társasház'}`)
        : '';
      const emailSenderBanner = !isAdminSender
        ? (isEn()
            ? `From: ${enrichedActor.name || senderEmailForReply}${senderLabel ? ` (${senderLabel})` : ''}`
            : `Feladó: ${enrichedActor.name || senderEmailForReply}${senderLabel ? ` (${senderLabel})` : ''}`)
        : '';

      // Group Resident -> SZVB committee emails into 1 email with CC: all other SZVB members + Reply-To: resident
      // while NEVER exposing SZVB emails to the resident.
      // For SZVB -> Residents announcements, ALWAYS dispatch individually (ZERO CC, resident emails strictly hidden!).
      const dispatchJobs = [];
      const szvbGroup = [];
      const otherRecipients = [];
      const seenEmails = new Set();

      (payload.recipients || []).forEach((r) => {
        if (!r?.email) return;
        if (isResidentSender && r.targetProfile?.type === 'szvb') {
          if (!szvbGroup.some((x) => x.email === r.email)) {
            szvbGroup.push(r);
          }
        } else if (!seenEmails.has(r.email)) {
          seenEmails.add(r.email);
          otherRecipients.push(r);
        }
      });

      if (szvbGroup.length > 0) {
        dispatchJobs.push({
          recipientEmail: szvbGroup[0].email,
          ccEmails: szvbGroup.slice(1).map((x) => x.email),
          recipientName: szvbGroup[0].name || 'SZVB',
          flatNum: '',
        });
      }
      otherRecipients.forEach((r) => {
        dispatchJobs.push({
          recipientEmail: r.email,
          ccEmails: [], // Strictly individual/BCC delivery — never expose other residents' email addresses!
          recipientName: r.name || r.email,
          flatNum: r.flatNum || '',
        });
      });

      await Promise.all(
        dispatchJobs.map(async (job) => {
          try {
            const sendRes = await sendResidentCustomNoticeEmail({
              recipientEmail: job.recipientEmail,
              ccEmails: job.ccEmails,
              recipientName: job.recipientName,
              flatNum: job.flatNum,
              subject: subject.trim(),
              messageBody: body.trim(),
              category: category || 'general',
              targetBuilding: building,
              repProfile: cur.repProfile || {},
              organizations: cur.organizations || [],
              senderUser: enrichedActor,
              senderEmail: senderEmailForReply,
              replyToOverride: senderEmailForReply,
              headerTitle: emailHeaderTitle,
              senderBannerText: emailSenderBanner,
              isEn: isEn(),
              emailSettings: building.emailSettings || cur.emailSettings || {},
            });
            if (sendRes && sendRes.success) {
              emailsSent += 1 + (job.ccEmails?.length || 0);
            } else {
              emailsFailed += 1;
              if (!firstEmailError) firstEmailError = sendRes?.message || '';
            }
          } catch (err) {
            emailsFailed += 1;
            if (!firstEmailError) firstEmailError = err?.message || '';
          }
        })
      );
    }

    const senderCopyWithDelivery = {
      ...payload.senderCopyNotification,
      meta: {
        ...(payload.senderCopyNotification.meta || {}),
        deliveryChannel,
        emailsSent,
        emailsFailed,
      },
    };

    const allNewNotifs = [
      ...(sendInApp ? payload.recipientNotifications : []),
      senderCopyWithDelivery,
    ];

    const updater = (prev) => {
      const curNotifs = Array.isArray(prev.notifications) ? prev.notifications : [];
      const nextBuildings = payload.syncedAuditOpinion
        ? (prev.buildings || []).map((b) =>
            b.id === building.id
              ? { ...b, auditOpinions: [payload.syncedAuditOpinion, ...(b.auditOpinions || [])] }
              : b
          )
        : prev.buildings;

      return {
        ...prev,
        buildings: nextBuildings,
        notifications: [...allNewNotifs, ...curNotifs].slice(0, 400),
        lastUpdated: Date.now(),
        revision: (prev.revision || 0) + 1,
      };
    };

    if (IS_FIRESTORE_MODE) {
      try {
        await callSendDirectMail({
          buildingId: building.id,
          recipientMode: recipientMode || 'kk',
          includeKk: includeKk !== false,
          includeSzvb: Boolean(includeSzvb),
          includeAuditor: Boolean(includeAuditor),
          includeResidents: Boolean(includeResidents),
          selectedSzvbEmails: Array.isArray(selectedSzvbEmails) ? selectedSzvbEmails : [],
          replyToEmail: replyToNotif?.actorEmail || '',
          replyToProfileType: replyToNotif?.meta?.senderProfile?.type || '',
          replyToFlatNum: replyToNotif?.meta?.senderFlatNum || replyToNotif?.flatNum || null,
          threadId: payload.threadId || '',
          replyToId: replyToNotif?.id || null,
          subject: subject.trim(),
          body: body.trim(),
          attachments: uploadedAttachments,
          senderRole: enrichedActor?.role || '',
          senderName: enrichedActor?.name || enrichedActor?.email || '',
          senderFlatNum: enrichedActor?.flatNum || null,
          deliveryChannel,
          sendInApp,
        });
      } catch (err) {
        console.warn('Firestore sendDirectMail error:', err?.message);
        if (typeof showToast === 'function') {
          showToast(
            isEn() ? 'Failed to send message.' : 'Nem sikerült elküldeni a levelet.',
            'error'
          );
        }
        return { success: false, error: err?.message };
      }
    }

    if (typeof persistState === 'function') {
      await persistState(updater, payload.syncedAuditOpinion ? true : 'notificationsOnly');
    } else if (typeof setState === 'function') {
      setState(updater);
    }

    if (typeof showToast === 'function') {
      if (sendEmail && emailsFailed > 0 && emailsSent === 0) {
        showToast(
          sendInApp
            ? (isEn()
                ? `Delivered in-app, but email sending failed${firstEmailError ? `: ${firstEmailError}` : '.'}`
                : `Az alkalmazáson belül megérkezett, de az e-mail küldés sikertelen volt${firstEmailError ? `: ${firstEmailError}` : '.'}`)
            : (isEn()
                ? `Email delivery failed${firstEmailError ? `: ${firstEmailError}` : '.'}`
                : `Az e-mail küldése sikertelen volt${firstEmailError ? `: ${firstEmailError}` : '.'}`),
          'warning'
        );
      } else if (sendEmail && sendInApp) {
        showToast(
          isEn()
            ? `Message sent in-app and via email (${emailsSent} email(s))!`
            : `Levél elküldve az alkalmazáson belül és e-mailben is (${emailsSent} db)!`,
          'success'
        );
      } else if (sendEmail) {
        showToast(
          isEn()
            ? `Email sent successfully (${emailsSent} recipient(s))!`
            : `E-mail sikeresen elküldve (${emailsSent} címzettnek)!`,
          'success'
        );
      } else {
        showToast(
          isEn() ? 'Message sent successfully!' : 'Levél sikeresen elküldve!',
          'success'
        );
      }
    }

    return {
      success: true,
      recipientCount: payload.recipients.length,
      emailsSent,
      emailsFailed,
      deliveryChannel,
      syncedAuditOpinion: payload.syncedAuditOpinion,
    };
  };

  return {
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems,
    sendCustomResidentNotice,
    sendDirectMessage,
    fetchMailAttachment,
    executeAutomatedDunningDailyCheck,
  };
}
