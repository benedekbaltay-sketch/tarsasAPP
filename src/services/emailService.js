/**
 * Central Transactional Email Service for TarsasApp (powered by Resend).
 * 
 * Features:
 *  - Single central Resend integration (3,000 free emails/month).
 *  - Zero configuration required from common representatives (KK).
 *  - Dynamic Reply-To routing: Automatically routes recipient replies directly to
 *    the active building manager / representative whose contact is displayed on
 *    that condominium's resident dashboard.
 */

import {
  buildInviteWelcomeEmailContent,
  buildForgotPasswordEmailContent,
  resolveBuildingResidentContact,
  normalizeEmail,
} from '../utils/teamPermissions.js';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseInstance } from '../constants/firebaseConfig.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the active resident-facing contact email for a given condominium.
 * If personal manager contact is active on the building, returns their personal email.
 * Otherwise returns the central company / owner email.
 */
export function resolveBuildingResidentEmail(building, repProfile = {}, organizations = []) {
  if (!building) return '';
  const contact = resolveBuildingResidentContact(building, repProfile, organizations);
  const email = normalizeEmail(contact?.email);
  return EMAIL_RE.test(email) ? email : '';
}

/**
 * Resolves effective Resend API key and sender defaults.
 * Can be defined once centrally via environment variable or system settings.
 */
export function resolveEffectiveEmailSettings(customSettings = {}) {
  const envResendKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_RESEND_API_KEY
    ? import.meta.env.VITE_RESEND_API_KEY
    : '';

  const apiKey = String(customSettings?.apiKey || envResendKey || '').trim();
  const senderName = String(customSettings?.senderName || 'HazApp').trim();
  const senderEmail = String(customSettings?.senderEmail || 'ertesito@mail.hazapp.hu').trim();

  // In the browser runtime, Firebase Cloud Functions executes transactional emails server-side.
  const isBrowser = typeof window !== 'undefined';
  const isConfigured = Boolean(apiKey || isBrowser);

  return {
    isConfigured,
    provider: 'resend',
    apiKey,
    senderName,
    senderEmail,
  };
}

/**
 * Sends a transactional email through the central Resend API.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  senderName = 'TarsasApp',
  apiKey = '',
} = {}) {
  const cleanTo = normalizeEmail(to);
  if (!cleanTo || !EMAIL_RE.test(cleanTo)) {
    return { success: false, error: 'invalid-recipient', message: 'Érvénytelen címzett e-mail cím.' };
  }

  const cleanReplyTo = replyTo && EMAIL_RE.test(normalizeEmail(replyTo))
    ? normalizeEmail(replyTo)
    : undefined;

  const cleanSenderName = String(senderName || 'HazApp').trim();
  const fromAddress = from && from.includes('@')
    ? (from.includes('<') ? from : `${cleanSenderName} <${from}>`)
    : `${cleanSenderName} <ertesito@mail.hazapp.hu>`;

  const payload = {
    from: fromAddress,
    to: [cleanTo],
    subject: subject || 'HazApp értesítés',
    html: html || '',
    text: text || '',
  };
  if (cleanReplyTo) {
    payload.reply_to = cleanReplyTo;
    payload.replyTo = cleanReplyTo;
  }

  // 1. Try Firebase Callable Cloud Function (executes server-side on Google Cloud, no browser CORS/CSP blocks)
  try {
    const { functions } = getFirebaseInstance();
    if (functions) {
      const fn = httpsCallable(functions, 'sendTransactionalEmail');
      const res = await fn(payload);
      if (res?.data?.success) {
        return { success: true, messageId: res.data.messageId, provider: 'resend', replyTo: cleanReplyTo };
      }
      if (res?.data && res.data.success === false) {
        return { success: false, error: res.data.error || 'resend-failed', message: res.data.message || 'Hiba a levélküldéskor.' };
      }
    }
  } catch (fnErr) {
    console.warn('[sendTransactionalEmail] Cloud Function attempt notice:', fnErr?.message);
    // If running in browser without local API key, return the function error message
    if (!apiKey && !(typeof import.meta !== 'undefined' && import.meta.env?.VITE_RESEND_API_KEY)) {
      return { success: false, error: 'cloud-function-failed', message: fnErr?.message || 'Hiba a levélküldéskor.' };
    }
  }

  // 2. Direct fetch fallback (for unit tests / Node.js test runners)
  const cleanApiKey = String(apiKey || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RESEND_API_KEY) || '').trim();
  if (!cleanApiKey) {
    return { success: false, error: 'missing-api-key', message: 'Nincs beállítva központi Resend API kulcs.' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data?.id) {
      return { success: true, messageId: data.id, provider: 'resend', replyTo: cleanReplyTo };
    }
    const errMsg = data?.message || data?.error?.message || `HTTP ${resp.status}`;
    return { success: false, error: 'resend-failed', message: errMsg };
  } catch (err) {
    return { success: false, error: 'network-error', message: err?.message || 'Hálózati hiba a Resend hívásakor.' };
  }
}

/**
 * Sends a colleague invitation HTML email with automatically resolved Reply-To header
 * matching the condominium's active resident contact.
 */
export async function sendColleagueInviteCustomEmail({
  recipientName = '',
  recipientEmail = '',
  orgName = '',
  inviterName = '',
  inviterEmail = '',
  buildingNames = [],
  buildingScope = 'selected',
  actionUrl = '',
  targetBuilding = null,
  repProfile = {},
  organizations = [],
  isEn = false,
  emailSettings = {},
} = {}) {
  const effective = resolveEffectiveEmailSettings(emailSettings);
  if (!effective.isConfigured) {
    return { success: false, skipped: true, error: 'not-configured', message: 'Nincs beállítva központi Resend API kulcs.' };
  }

  // Dynamically resolve Reply-To:
  // 1. If assigned to a specific building, use that building's active resident contact email
  // 2. Otherwise fall back to the inviter's email
  let dynamicReplyTo = '';
  if (targetBuilding) {
    dynamicReplyTo = resolveBuildingResidentEmail(targetBuilding, repProfile, organizations);
  }
  if (!dynamicReplyTo) {
    dynamicReplyTo = normalizeEmail(inviterEmail);
  }

  const { subject, textBody, htmlBody } = buildInviteWelcomeEmailContent({
    recipientName,
    recipientEmail,
    orgName,
    inviterName,
    inviterEmail,
    buildingNames,
    buildingScope,
    actionUrl,
    isEn,
  });

  return sendTransactionalEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
    from: effective.senderEmail,
    replyTo: dynamicReplyTo,
    senderName: effective.senderName || orgName || 'TarsasApp',
    apiKey: effective.apiKey,
  });
}

/**
 * Sends a custom broadcast / direct notice email to a condominium resident
 * with automatic Reply-To routing matching the building's active manager or company contact.
 */
export async function sendResidentCustomNoticeEmail({
  recipientEmail = '',
  recipientName = '',
  flatNum = '',
  subject = '',
  messageBody = '',
  bodyText = '',
  category = 'general',
  targetBuilding = null,
  repProfile = {},
  organizations = [],
  senderUser = null,
  senderEmail = '',
  isEn = false,
  emailSettings = {},
  includeGreeting = false,
} = {}) {
  const effective = resolveEffectiveEmailSettings(emailSettings);
  if (!effective.isConfigured) {
    return { success: false, skipped: true, error: 'not-configured', message: 'Nincs beállítva központi Resend API kulcs.' };
  }

  const effectiveBody = messageBody || bodyText || '';
  const fallbackSender = normalizeEmail(senderEmail || senderUser?.email);
  const dynamicReplyTo = (targetBuilding
    ? resolveBuildingResidentEmail(targetBuilding, repProfile, organizations)
    : '') || fallbackSender;

  const buildingName = targetBuilding?.officialName || targetBuilding?.name || (isEn ? 'Condominium' : 'Társasház');
  const greeting = recipientName 
    ? (isEn ? `Dear ${recipientName} (Flat ${flatNum}),` : `Kedves ${recipientName} (${flatNum}. lakás)!`)
    : (flatNum ? (isEn ? `Dear Resident of Flat ${flatNum},` : `Kedves ${flatNum}. lakás Tulajdonos / Lakó!`) : (isEn ? 'Dear Resident,' : 'Kedves Lakó!'));

  const escapedBody = (effectiveBody || '')
    .split('\n')
    .map(p => p.trim() ? `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #374151;">${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br/>')
    .join('');

  // Only prepend greeting if explicitly requested or if body doesn't contain custom text
  const greetingHtml = includeGreeting
    ? `<p style="font-weight: 600; margin: 0 0 16px 0; color: #111827;">${greeting}</p>`
    : '';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1E3A8A; padding: 22px 32px; text-align: left;">
              <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: 0.3px;">${isEn ? 'Official Management Notice' : 'Hivatalos Közös Képviseleti Tájékoztató'}</h2>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px; font-size: 14px; color: #1f2937;">
              ${greetingHtml}
              ${escapedBody}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 4px 0;"><strong>${buildingName}</strong></p>
              ${targetBuilding?.address ? `<p style="margin: 0 0 4px 0;">${targetBuilding.address}</p>` : ''}
              ${dynamicReplyTo ? `<p style="margin: 0;">${isEn ? 'Direct reply to:' : 'Válasz közvetlenül ide:'} <a href="mailto:${dynamicReplyTo}" style="color: #1E3A8A; font-weight: 600;">${dynamicReplyTo}</a></p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textBody = `${isEn ? 'Official Management Notice' : 'Hivatalos Közös Képviseleti Tájékoztató'}: ${subject}\n\n${includeGreeting ? `${greeting}\n\n` : ''}${messageBody}\n\n---\n${buildingName}\n${dynamicReplyTo ? `Reply-To: ${dynamicReplyTo}` : ''}`;

  return sendTransactionalEmail({
    to: recipientEmail,
    subject: subject || (isEn ? 'Notice from Property Management' : 'Közös képviseleti tájékoztató'),
    html: htmlBody,
    text: textBody,
    from: effective.senderEmail,
    replyTo: dynamicReplyTo,
    senderName: effective.senderName || buildingName || 'TarsasApp',
    apiKey: effective.apiKey,
  });
}
