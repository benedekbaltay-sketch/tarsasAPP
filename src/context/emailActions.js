/**
 * Action creators for email communication, automated dunning rules, direct resident notices, and outbox logs.
 */

import { DEFAULT_DUNNING_RULES, buildPaymentDetailsBlock, resolveFlatOwnerName } from '../utils/dunningRules.js';
import { canUserManageBuilding, buildNotification } from '../utils/teamPermissions.js';
import { sendResidentCustomNoticeEmail } from '../services/emailService.js';

export function createEmailActions(optionsOrState, maybeSetState) {
  let state, setState, persistState, showToast, t;
  if (typeof maybeSetState === 'function') {
    state = optionsOrState;
    setState = maybeSetState;
  } else {
    ({ state, setState, persistState, showToast, t } = optionsOrState || {});
  }

  const isEn = () => (state?.currentLang === 'en');

  const checkManagePerm = (buildingId) => {
    if (!state?.currentUser) return false;
    // If specific building, check permission on that building
    if (buildingId && buildingId !== 'all') {
      return canUserManageBuilding(state.currentUser, buildingId, state.organizations, state.buildings);
    }
    // If 'all', user must have permission on at least one or be owner/superadmin
    return canUserManageBuilding(state.currentUser, null, state.organizations, state.buildings);
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

    const updater = (prev) => {
      const currentRules = Array.isArray(prev.emailRules) && prev.emailRules.length > 0 
        ? prev.emailRules 
        : JSON.parse(JSON.stringify(DEFAULT_DUNNING_RULES));
      const existingIdx = currentRules.findIndex((r) => r.id === ruleData.id);
      let updatedRules;
      if (existingIdx >= 0) {
        updatedRules = currentRules.map((r, idx) => (idx === existingIdx ? { ...r, ...ruleData, updatedAt: new Date().toISOString() } : r));
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

    const updater = (prev) => {
      const rules = Array.isArray(prev.emailRules) ? prev.emailRules : [];
      return {
        ...prev,
        emailRules: rules.filter((r) => r.id !== ruleId),
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

    for (const r of recipients) {
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

      // 2. Dispatch transactional email (non-blocking in background)
      let emailStatus = 'skipped';
      if (sendEmail && r.email) {
        emailStatus = 'sent';
        sendResidentCustomNoticeEmail({
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
        }).catch((err) => {
          console.warn('sendResidentCustomNoticeEmail async error:', err.message);
        });
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
        status: (sendEmail && r.email) ? 'sent' : 'in-app-only',
        queuedAt: new Date().toISOString(),
      });
    }

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

    if (typeof showToast === 'function') {
      showToast(
        isEn()
          ? `Notice successfully sent to ${recipients.length} recipients!`
          : `Levél sikeresen elküldve ${recipients.length} címzettnek!`
      );
    }

    return { success: true, count: recipients.length };
  };

  return {
    saveEmailRule,
    deleteEmailRule,
    toggleEmailRule,
    queueOutboxItems,
    clearOutboxItems,
    sendCustomResidentNotice,
  };
}
