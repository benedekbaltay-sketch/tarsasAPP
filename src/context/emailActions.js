/**
 * Action creators for email communication, automated dunning rules, direct resident notices, and outbox logs.
 */

import { 
  DEFAULT_DUNNING_RULES, 
  buildPaymentDetailsBlock, 
  resolveFlatOwnerName,
  getBudapestTimeParts,
  shouldRuleAutoDispatchToday,
  evaluateRulesForAutoDispatch
} from '../utils/dunningRules.js';
import { canUserManageBuilding, buildNotification } from '../utils/teamPermissions.js';
import { sendResidentCustomNoticeEmail, resolveEffectiveEmailSettings } from '../services/emailService.js';
import { getPermanentVault, savePermanentVault } from './syncEngine.js';

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

    // Clear today's local persistent lock if schedule was edited
    try {
      if (typeof localStorage !== 'undefined' && ruleData.id) {
        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`tarsas_dunning_rule_${ruleData.id}_${todayStr}`);
      }
    } catch (e) {}

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
        updatedRules = currentRules.map((r, idx) => (idx === existingIdx ? { 
          ...r, 
          ...ruleData, 
          lastAutoDispatchedDate: scheduleChanged ? null : (r.lastAutoDispatchedDate || null),
          updatedAt: new Date().toISOString() 
        } : r));
      } else {
        const newRule = {
          ...ruleData,
          id: ruleData.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString()
        };
        updatedRules = [newRule, ...currentRules];
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
      return {
        ...prev,
        emailRules: rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
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
        queuedAt: new Date().toISOString()
      }));
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
    const updater = (prev) => ({
      ...prev,
      emailOutbox: [],
      lastUpdated: Date.now(),
      revision: (prev.revision || 0) + 1
    });

    if (typeof persistState === 'function') {
      persistState(updater, true);
    } else if (typeof setState === 'function') {
      setState(updater);
    }
    return true;
  };

  /**
   * Broadcasts / sends a direct resident notice letter to targeted recipients
   * with delivery via transactional email and/or in-app notification bell.
   */
  const sendCustomResidentNotice = async ({
    buildingId,
    recipients = [],
    subject = '',
    body = '',
    category = 'general',
    sendEmail = true,
    sendInAppNotification = true,
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
      const now = new Date();
      const dueDate = new Date(now.getTime() + (8 * 24 * 60 * 60 * 1000));
      const dueDateFormatted = isEn()
        ? dueDate.toLocaleDateString('en-GB')
        : `${dueDate.getFullYear()}. ${String(dueDate.getMonth() + 1).padStart(2, '0')}. ${String(dueDate.getDate()).padStart(2, '0')}.`;

      const resolvedOwner = r.name || resolveFlatOwnerName(rFlat, isEn());

      // Personalize body for tags
      const personalizedBody = body
        .replace(/\{lakasTulajdonosa\}|\{flatOwner\}|\{tulajdonosNeve\}|\{ownerName\}|\{\{\s*lakas_tulajdonosa\s*\}\}|\{\{\s*flat_owner\s*\}\}|\{\{\s*tulajdonos_neve\s*\}\}|\{\{\s*owner_name\s*\}\}/gi, resolvedOwner)
        .replace(/\{lakasszam\}|\{flatNum\}|\{\{\s*lakas_szam\s*\}\}|\{\{\s*flat_num\s*\}\}/gi, r.flatNum || '')
        .replace(/\{tarsashazNeve\}|\{buildingName\}|\{\{\s*tarsashaz_neve\s*\}\}|\{\{\s*building_name\s*\}\}/gi, bldName)
        .replace(/\{aktualisEgyenleg\}|\{egyenleg\}|\{balance\}|\{\{\s*hatralek_osszeg\s*\}\}|\{\{\s*arrears_amount\s*\}\}/gi, r.balanceFormatted || '')
        .replace(/\{fizetesiAdatok\}|\{paymentDetails\}|\{\{\s*fizetesi_adatok\s*\}\}|\{\{\s*payment_details\s*\}\}/gi, paymentDetails)
        .replace(/\{fizetesiHatarido\}|\{dueDate\}|\{\{\s*fizetesi_hatarido\s*\}\}|\{\{\s*due_date\s*\}\}/gi, dueDateFormatted)
        .replace(/\{kepviseloNeve\}|\{managerName\}|\{\{\s*kepviselo_neve\s*\}\}|\{\{\s*manager_name\s*\}\}/gi, rBuilding?.managerContact?.name || state?.repProfile?.name || state?.currentUser?.name || '')
        .replace(/\{cegNeve\}|\{companyName\}|\{\{\s*ceg_neve\s*\}\}|\{\{\s*company_name\s*\}\}/gi, state?.repProfile?.companyName || '');

      // 1. In-app notification
      if (sendInAppNotification) {
        newNotifications.push(
          buildNotification({
            type: category || 'info',
            severity: category === 'urgent' ? 'critical' : category === 'finance' ? 'warning' : 'info',
            recipientEmail: r.email || '',
            recipientScope: 'flat',
            buildingId: bldId,
            buildingName: bldName,
            actorUser: state.currentUser,
            titleHu: subject,
            titleEn: subject,
            messageHu: personalizedBody,
            messageEn: personalizedBody,
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
        debt: r.balance,
        status: emailStatus,
        errorMessage: emailErrorMessage,
        sendEmail,
        sendInApp: sendInAppNotification,
        queuedAt: new Date().toISOString(),
        sentAt: emailWasSent ? new Date().toISOString() : undefined,
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
        const now = options.testDate || new Date();
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
            currentDate: options.testDate || new Date(),
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
          // 3. Flat-level deduplication: check if this flat already received notice today
          const alreadyNotifiedToday = (curState.notifications || []).some(n => {
            if (!n) return false;
            const notifDate = (n.createdAt || '').slice(0, 10);
            if (notifDate !== dateStr) return false;
            const sameBuilding = n.buildingId === m.buildingId;
            const sameEmail = n.recipientEmail && m.ownerEmail && n.recipientEmail.toLowerCase() === m.ownerEmail.toLowerCase();
            const sameFlat = (n.titleHu && n.titleHu.includes(`${m.flatNum}.`)) || (n.messageHu && n.messageHu.includes(`${m.flatNum}.`));
            return sameBuilding && (sameEmail || sameFlat);
          }) || newNotifications.some(n => {
            const sameBuilding = n.buildingId === m.buildingId;
            const sameEmail = n.recipientEmail && m.ownerEmail && n.recipientEmail.toLowerCase() === m.ownerEmail.toLowerCase();
            const sameFlat = (n.titleHu && n.titleHu.includes(`${m.flatNum}.`));
            return sameBuilding && (sameEmail || sameFlat);
          });

          const alreadySentToday = (curState.emailOutbox || []).some(o => {
            if (!o) return false;
            // Simulated or failed notices do not block real sending
            if (o.status !== 'sent') return false;
            const oDate = (o.sentAt || o.queuedAt || '').slice(0, 10);
            if (oDate !== dateStr) return false;
            return o.buildingId === m.buildingId && String(o.flatNum) === String(m.flatNum);
          }) || newOutboxEntries.some(o => {
            return o.status === 'sent' && o.buildingId === m.buildingId && String(o.flatNum) === String(m.flatNum);
          });

          // Block duplicate sending only if already successfully sent today, unless explicitly forced
          if (alreadySentToday && !options.testDate && !options.forceRuleId) {
            continue;
          }

          const hasValidEmail = Boolean(m.ownerEmail && m.ownerEmail.includes('@'));
          let wasSent = false;

          if (shouldSendEmail && hasValidEmail && emailSettings.isConfigured && !options.dryRunOnly) {
            try {
              const bld = (curState.buildings || []).find(b => b.id === m.buildingId);
              const sendResult = await sendResidentCustomNoticeEmail({
                recipientEmail: m.ownerEmail,
                recipientName: m.ownerName,
                flatNum: m.flatNum,
                subject: m.renderedSubject,
                messageBody: m.renderedBody,
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
              console.warn('[autoDunningDispatch] Failed to send email to', m.ownerEmail, err?.message);
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
            else if (!hasValidEmail) outboxStatus = shouldSendInApp ? 'in-app-only' : 'failed';
            else outboxStatus = 'failed';
          } else {
            outboxStatus = 'in-app-only';
          }

          // Add outbox log entry
          newOutboxEntries.push({
            id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ruleId: rule.id,
            ruleName: isEn() ? (rule.nameEn || rule.name) : rule.name,
            buildingId: m.buildingId,
            buildingName: m.buildingName,
            flatNum: m.flatNum,
            recipientName: m.ownerName,
            recipientEmail: m.ownerEmail || (isEn() ? "No email provided" : "Nincs e-mail"),
            subject: m.renderedSubject,
            body: m.renderedBody,
            debt: m.balance,
            arrearsMonths: m.arrearsMonths,
            status: outboxStatus,
            sendEmail: shouldSendEmail,
            sendInApp: shouldSendInApp,
            autoDispatched: true,
            queuedAt: new Date().toISOString(),
            sentAt: wasSent ? new Date().toISOString() : undefined,
          });

          // Add in-app notification only if in-app delivery is enabled
          if (shouldSendInApp) {
            newNotifications.push(
              buildNotification({
                type: 'finance',
                severity: 'warning',
                recipientEmail: m.ownerEmail || '',
                recipientScope: 'flat',
                buildingId: m.buildingId,
                buildingName: m.buildingName,
                actorUser: curState.currentUser,
                titleHu: m.renderedSubject,
                titleEn: m.renderedSubject,
                messageHu: m.renderedBody,
                messageEn: m.renderedBody,
              })
            );
          }
        }

        updatedRuleMarkers[rule.id] = {
          lastAutoDispatchedDate: dateStr,
          lastAutoDispatchedAt: new Date().toISOString(),
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

  return {
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems,
    sendCustomResidentNotice,
    executeAutomatedDunningDailyCheck,
  };
}
