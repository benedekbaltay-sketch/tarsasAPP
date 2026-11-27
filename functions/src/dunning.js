/**
 * Scheduled Daily Dunning & Arrears Email Automation (Europe/Budapest 08:00 AM)
 *
 * Runs every morning at 08:00 Budapest time. Inspects enabled dunning rules whose
 * checkDayOfMonth matches today, evaluates overdue unit balances, and dispatches
 * transactional notice emails via Resend API.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

function parseDispatchTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return { hour: 8, minute: 0 };
  const parts = timeStr.trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
  return { hour: h, minute: m };
}

function getBudapestParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getPart = (t) => parts.find((p) => p.type === t)?.value || '';
  const year = getPart('year');
  const month = getPart('month');
  const day = Number(getPart('day')) || 1;
  const hour = Number(getPart('hour')) || 0;
  const minute = Number(getPart('minute')) || 0;
  const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, dateStr };
}

export const scheduledDailyDunningEmails = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Europe/Budapest',
    region: 'europe-west1',
  },
  async () => {
    const now = new Date();
    const { day, hour, minute, dateStr } = getBudapestParts(now);
    const currentTotalMinutes = hour * 60 + minute;

    const resendKey = (process.env.RESEND_API_KEY || '').trim();

    try {
      const rtdb = getDatabase();
      const stateSnap = await rtdb.ref('condo_state').once('value');
      const state = stateSnap.val();
      if (!state) return;

      const rules = Array.isArray(state.emailRules) ? state.emailRules : [];
      const enabledDueRules = rules.filter((r) => {
        if (!r || !r.enabled) return false;
        if (Number(r.checkDayOfMonth || 15) !== day) return false;
        if (r.lastAutoDispatchedDate === dateStr) return false;
        const targetTime = parseDispatchTime(r.dispatchTime);
        const targetTotalMinutes = targetTime.hour * 60 + targetTime.minute;
        return currentTotalMinutes >= targetTotalMinutes;
      });

      if (enabledDueRules.length === 0) {
        console.log(`[scheduledDailyDunningEmails] No enabled rules due for day ${day} (date: ${dateStr}).`);
        return;
      }

      console.log(`[scheduledDailyDunningEmails] Processing ${enabledDueRules.length} rules due for ${dateStr}.`);

      const buildings = Array.isArray(state.buildings) ? state.buildings : [];
      const outbox = Array.isArray(state.emailOutbox) ? state.emailOutbox : [];
      const notifications = Array.isArray(state.notifications) ? state.notifications : [];
      const newOutboxEntries = [];
      const newNotifications = [];
      const updatedRules = [...rules];

      for (const rule of enabledDueRules) {
        const shouldSendEmail = rule.sendEmail !== false;
        const shouldSendInApp = rule.sendInApp !== false;
        const ruleTargetBuilding = rule.buildingId || 'all';
        const targetBuildings = ruleTargetBuilding === 'all'
          ? buildings
          : buildings.filter((b) => b && b.id === ruleTargetBuilding);

        let sentForRule = 0;

        for (const b of targetBuildings) {
          const flats = Array.isArray(b.flats) ? b.flats : [];
          for (const flat of flats) {
            const bal = (Number(flat.balance) || 0) + (Number(flat.renovationBalance) || 0);
            if (bal >= 0) continue; // Zero debt

            // Resolve all owners for this flat
            let owners = Array.isArray(flat.owners) && flat.owners.length > 0 ? flat.owners : [];
            if (owners.length === 0) {
              owners = [{
                name: flat.ownerName || flat.owner || `${flat.flatNum}. lakás tulajdonosa`,
                email: (flat.email || '').trim(),
                sendEmailNotification: true,
              }];
            }

            for (const owner of owners) {
              const flatOwner = (owner.name || flat.ownerName || flat.owner || `${flat.flatNum}. lakás tulajdonosa`).trim();
              const flatEmail = (owner.email || (owners.length === 1 ? flat.email : '') || '').trim();
              if (owner.sendEmailNotification === false) continue;

              // Deduplication: if this flat and specific email already received a sent notice today, NEVER send again today!
              const alreadySentToday = outbox.some(o => {
                if (!o || o.status !== 'sent') return false;
                const oDate = (o.sentAt || o.queuedAt || '').slice(0, 10);
                if (oDate !== dateStr) return false;
                const sameBuilding = String(o.buildingId || '') === String(b.id || '');
                const sameFlat = String(o.flatNum || '') === String(flat.flatNum || '');
                const sameEmail = Boolean(flatEmail && o.recipientEmail && o.recipientEmail.toLowerCase() === flatEmail.toLowerCase());
                return sameBuilding && sameFlat && sameEmail;
              }) || newOutboxEntries.some(o => {
                if (o.status !== 'sent') return false;
                const sameBuilding = String(o.buildingId || '') === String(b.id || '');
                const sameFlat = String(o.flatNum || '') === String(flat.flatNum || '');
                const sameEmail = Boolean(flatEmail && o.recipientEmail && o.recipientEmail.toLowerCase() === flatEmail.toLowerCase());
                return sameBuilding && sameFlat && sameEmail;
              });

              if (alreadySentToday) continue;
              const bName = b.officialName || b.name || 'Társasház';
              const bEmail = (b.managerContact?.email || b.email || state.repProfile?.email || '').trim();
              const debtAmount = Math.abs(bal).toLocaleString('hu-HU') + ' Ft';

              const subject = (rule.templateSubject || 'Egyenleg-értesítő: {{tarsashaz_neve}}, {{lakas_szam}}. lakás')
                .replace(/\{\{\s*tarsashaz_neve\s*\}\}/gi, bName)
                .replace(/\{\{\s*lakas_szam\s*\}\}/gi, String(flat.flatNum));

              const body = (rule.templateBody || 'Kedves {{lakas_tulajdonosa}}!\n\nHátralék: {{hatralek_osszeg}}')
                .replace(/\{\{\s*lakas_tulajdonosa\s*\}\}|\{\{\s*tulajdonos_neve\s*\}\}/gi, flatOwner)
                .replace(/\{\{\s*osszes_tulajdonos\s*\}\}/gi, flat.ownerName || flatOwner)
                .replace(/\{\{\s*tarsashaz_neve\s*\}\}/gi, bName)
                .replace(/\{\{\s*lakas_szam\s*\}\}/gi, String(flat.flatNum))
                .replace(/\{\{\s*hatralek_osszeg\s*\}\}/gi, debtAmount);

              let wasSent = false;
              if (shouldSendEmail && resendKey && flatEmail && flatEmail.includes('@')) {
                try {
                  const mailPayload = {
                    from: 'Közös Képviselet <kozoskepviselet@mail.hazapp.hu>',
                    to: [flatEmail],
                    subject,
                    text: body,
                  };
                  if (bEmail && bEmail.includes('@')) {
                    mailPayload.reply_to = bEmail;
                  }
                  const resp = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${resendKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(mailPayload),
                  });
                  const resData = await resp.json().catch(() => ({}));
                  wasSent = resp.ok && Boolean(resData?.id);
                } catch (err) {
                  console.warn(`[scheduledDailyDunningEmails] Failed to send email to ${flatEmail}:`, err.message);
                }
              }

              if (wasSent) {
                sentForRule++;
              }

              let status = 'in-app-only';
              if (shouldSendEmail) {
                status = wasSent ? 'sent' : (flatEmail ? 'failed' : (shouldSendInApp ? 'in-app-only' : 'failed'));
              }

              newOutboxEntries.push({
                id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                ruleId: rule.id,
                ruleName: rule.name || 'Felszólítási szabály',
                buildingId: b.id,
                buildingName: bName,
                flatNum: flat.flatNum,
                recipientName: flatOwner,
                recipientEmail: flatEmail || 'Nincs e-mail',
                subject,
                body,
                debt: bal,
                status,
                sendEmail: shouldSendEmail,
                sendInApp: shouldSendInApp,
                autoDispatched: true,
                queuedAt: new Date().toISOString(),
                sentAt: wasSent ? new Date().toISOString() : undefined,
              });

              if (shouldSendInApp) {
                newNotifications.push({
                  id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  type: 'finance',
                  severity: 'warning',
                  recipientEmail: flatEmail,
                  recipientScope: 'flat',
                  buildingId: b.id,
                  buildingName: bName,
                  titleHu: subject,
                  titleEn: subject,
                  messageHu: body,
                  messageEn: body,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }
        }

        const rIdx = updatedRules.findIndex((r) => r.id === rule.id);
        if (rIdx >= 0) {
          updatedRules[rIdx] = {
            ...updatedRules[rIdx],
            lastAutoDispatchedDate: dateStr,
            lastAutoDispatchedAt: new Date().toISOString(),
            lastAutoDispatchedCount: sentForRule,
          };
        }
      }

      // Update state in RTDB
      await rtdb.ref('condo_state').update({
        emailRules: updatedRules,
        emailOutbox: [...newOutboxEntries, ...outbox].slice(0, 500),
        notifications: [...newNotifications, ...notifications].slice(0, 300),
        lastUpdated: new Date().toISOString(),
      });

      console.log(`[scheduledDailyDunningEmails] Finished. ${newOutboxEntries.length} notices logged.`);
    } catch (err) {
      console.error('[scheduledDailyDunningEmails] Execution failed:', err);
    }
  }
);

/**
 * Callable Cloud Function: sendTransactionalEmail
 * Sends a transactional email securely from Google Cloud via Resend API,
 * bypassing client-side browser CORS restrictions and keeping API keys secure.
 */
export const sendTransactionalEmail = onCall(
  {
    region: 'europe-west1',
    cors: true,
  },
  async (request) => {
    const { to, cc, subject, html, text, from, replyTo, reply_to, senderName } = request.data || {};

    const cleanTo = Array.isArray(to) ? to[0] : to;
    if (!cleanTo || typeof cleanTo !== 'string' || !cleanTo.includes('@')) {
      throw new HttpsError('invalid-argument', 'Érvénytelen címzett e-mail cím.');
    }

    const cleanCc = Array.isArray(cc)
      ? Array.from(
          new Set(
            cc
              .map((addr) => String(addr || '').trim().toLowerCase())
              .filter((addr) => addr && addr.includes('@') && addr !== cleanTo.trim().toLowerCase())
          )
        ).slice(0, 25)
      : [];

    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (!resendKey) {
      throw new HttpsError('failed-precondition', 'Nincs beállítva szerveroldali RESEND_API_KEY.');
    }

    const cleanSenderName = String(senderName || 'Közös Képviselet').trim();
    const fromAddress = from && from.includes('@')
      ? (from.includes('<') ? from : `${cleanSenderName} <${from}>`)
      : `${cleanSenderName} <kozoskepviselet@mail.hazapp.hu>`;

    const payload = {
      from: fromAddress,
      to: [cleanTo.trim()],
      subject: subject || 'HazApp értesítés',
      html: html || '',
      text: text || '',
    };
    if (cleanCc.length > 0) {
      payload.cc = cleanCc;
    }
    const effectiveReplyTo = String(replyTo || reply_to || '').trim();
    if (effectiveReplyTo && effectiveReplyTo.includes('@')) {
      payload.reply_to = effectiveReplyTo;
    }

    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.id) {
        return { success: true, messageId: data.id, provider: 'resend' };
      }

      console.warn('[sendTransactionalEmail] Resend API error:', resp.status, data);
      return {
        success: false,
        error: data?.name || 'resend-error',
        message: data?.message || `Resend HTTP ${resp.status}`,
      };
    } catch (err) {
      console.error('[sendTransactionalEmail] Network exception:', err);
      return {
        success: false,
        error: 'network-error',
        message: err.message,
      };
    }
  }
);
