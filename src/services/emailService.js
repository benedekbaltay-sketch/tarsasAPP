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
  const senderName = String(customSettings?.senderName || 'TarsasApp').trim();
  const senderEmail = String(customSettings?.senderEmail || '').trim();

  return {
    isConfigured: Boolean(apiKey),
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

  const cleanApiKey = String(apiKey || '').trim();
  if (!cleanApiKey) {
    return { success: false, error: 'missing-api-key', message: 'Nincs beállítva központi Resend API kulcs.' };
  }

  const cleanReplyTo = replyTo && EMAIL_RE.test(normalizeEmail(replyTo))
    ? normalizeEmail(replyTo)
    : undefined;

  const cleanSenderName = String(senderName || 'TarsasApp').trim();
  const fromAddress = from && from.includes('@')
    ? (from.includes('<') ? from : `${cleanSenderName} <${from}>`)
    : `${cleanSenderName} <onboarding@resend.dev>`;

  const payload = {
    from: fromAddress,
    to: [cleanTo],
    subject: subject || 'TarsasApp értesítés',
    html: html || '',
    text: text || '',
  };
  if (cleanReplyTo) {
    payload.reply_to = cleanReplyTo;
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
