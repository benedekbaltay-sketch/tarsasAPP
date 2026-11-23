/**
 * Transactional Email Service for TarsasApp.
 * Supports Resend and Brevo APIs for sending responsive, branded HTML emails
 * with custom Reply-To headers (so replies land directly in the KK's specified inbox).
 */

import {
  buildInviteWelcomeEmailContent,
  buildForgotPasswordEmailContent,
  normalizeEmail,
} from '../utils/teamPermissions.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a transactional email through Resend or Brevo.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  senderName = 'TarsasApp',
  provider = 'resend',
  apiKey = '',
} = {}) {
  const cleanTo = normalizeEmail(to);
  if (!cleanTo || !EMAIL_RE.test(cleanTo)) {
    return { success: false, error: 'invalid-recipient', message: 'Érvénytelen címzett e-mail cím.' };
  }

  const cleanApiKey = String(apiKey || '').trim();
  if (!cleanApiKey) {
    return { success: false, error: 'missing-api-key', message: 'Nincs megadva tranzakciós e-mail API kulcs.' };
  }

  const cleanReplyTo = replyTo && EMAIL_RE.test(normalizeEmail(replyTo))
    ? normalizeEmail(replyTo)
    : undefined;

  const cleanSenderName = String(senderName || 'TarsasApp').trim();

  // Provider 1: Resend (https://resend.com)
  if (provider === 'resend') {
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
        return { success: true, messageId: data.id, provider: 'resend' };
      }
      const errMsg = data?.message || data?.error?.message || `HTTP ${resp.status}`;
      return { success: false, error: 'resend-failed', message: errMsg };
    } catch (err) {
      return { success: false, error: 'network-error', message: err?.message || 'Hálózati hiba a Resend hívásakor.' };
    }
  }

  // Provider 2: Brevo (https://www.brevo.com - formerly Sendinblue)
  if (provider === 'brevo') {
    const senderEmail = from && EMAIL_RE.test(normalizeEmail(from))
      ? normalizeEmail(from)
      : 'noreply@tarsasapp.hu';

    const payload = {
      sender: { name: cleanSenderName, email: senderEmail },
      to: [{ email: cleanTo }],
      subject: subject || 'TarsasApp értesítés',
      htmlContent: html || '',
      textContent: text || '',
    };
    if (cleanReplyTo) {
      payload.replyTo = { email: cleanReplyTo };
    }

    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': cleanApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && (data?.messageId || data?.messageIds)) {
        return { success: true, messageId: data.messageId || data.messageIds?.[0], provider: 'brevo' };
      }
      const errMsg = data?.message || `HTTP ${resp.status}`;
      return { success: false, error: 'brevo-failed', message: errMsg };
    } catch (err) {
      return { success: false, error: 'network-error', message: err?.message || 'Hálózati hiba a Brevo hívásakor.' };
    }
  }

  return { success: false, error: 'unsupported-provider', message: `Nem támogatott e-mail szolgáltató: ${provider}` };
}

/**
 * Resolves active email settings from provided settings or environment variables.
 */
export function resolveEffectiveEmailSettings(settings = {}) {
  const envResendKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_RESEND_API_KEY
    ? import.meta.env.VITE_RESEND_API_KEY
    : '';
  const envBrevoKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BREVO_API_KEY
    ? import.meta.env.VITE_BREVO_API_KEY
    : '';
  const envReplyTo = typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_REPLY_TO
    ? import.meta.env.VITE_EMAIL_REPLY_TO
    : '';

  const provider = settings?.provider || (envBrevoKey && !envResendKey ? 'brevo' : 'resend');
  const apiKey = String(settings?.apiKey || (provider === 'brevo' ? envBrevoKey : envResendKey) || '').trim();
  const replyTo = String(settings?.replyTo || envReplyTo || '').trim();
  const senderName = String(settings?.senderName || 'TarsasApp').trim();
  const senderEmail = String(settings?.senderEmail || '').trim();

  return {
    isConfigured: Boolean(apiKey),
    provider,
    apiKey,
    replyTo,
    senderName,
    senderEmail,
  };
}

/**
 * Sends a colleague invitation HTML email with customized Reply-To header and CTA button.
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
  isEn = false,
  emailSettings = {},
} = {}) {
  const effective = resolveEffectiveEmailSettings(emailSettings);
  if (!effective.isConfigured) {
    return { success: false, skipped: true, error: 'not-configured', message: 'Nincs beállítva tranzakciós e-mail API kulcs.' };
  }

  // The custom replyTo can be set explicitly by the KK in settings, falling back to inviter's email
  const effectiveReplyTo = effective.replyTo || inviterEmail || '';

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
    replyTo: effectiveReplyTo,
    senderName: effective.senderName || orgName || 'TarsasApp',
    provider: effective.provider,
    apiKey: effective.apiKey,
  });
}

/**
 * Sends a test email to verify the KK's email settings and Reply-To header.
 */
export async function sendTestSettingsEmail({
  targetEmail,
  emailSettings = {},
  isEn = false,
} = {}) {
  const effective = resolveEffectiveEmailSettings(emailSettings);
  if (!effective.isConfigured) {
    return {
      success: false,
      error: 'not-configured',
      message: isEn ? 'Please provide an API key first.' : 'Kérjük, először adj meg egy API kulcsot!',
    };
  }

  const effectiveReplyTo = effective.replyTo || targetEmail;
  const subject = isEn
    ? 'TarsasApp – Email Integration Test'
    : 'TarsasApp – E-mail integráció és Válaszcím teszt';

  const textBody = isEn
    ? `Congratulations! Your email integration (${effective.provider.toUpperCase()}) is working correctly.\n\nConfigured Reply-To address: ${effectiveReplyTo}\nIf someone replies to this email, it will arrive at: ${effectiveReplyTo}\n\nBest regards,\nThe TarsasApp Team`
    : `Gratulálunk! Az e-mail integrációd (${effective.provider.toUpperCase()}) sikeresen működik.\n\nBeállított válaszcím (Reply-To): ${effectiveReplyTo}\nHa valaki válaszol erre az e-mailre, a válasz ide fog megérkezni: ${effectiveReplyTo}\n\nÜdvözlettel,\nA TarsasApp Csapata`;

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;">
      <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
        <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;">TarsasApp</h2>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:#059669;background:#d1fae5;padding:4px 10px;border-radius:20px;">
          ${isEn ? 'Connection Active' : 'Sikeres kapcsolat'}
        </span>
      </div>
      <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">
        ${isEn ? 'Email Integration & Reply-To Test' : 'E-mail integráció és Válaszcím teszt'}
      </h3>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
        ${isEn
          ? `Your email sending setup with <strong>${effective.provider.toUpperCase()}</strong> is working seamlessly.`
          : `A tranzakciós e-mail küldési konfigurációd a(z) <strong>${effective.provider.toUpperCase()}</strong> szolgáltatóval tökéletesen működik.`}
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 20px;font-size:13px;line-height:1.7;">
        <div><strong style="color:#475569;">${isEn ? 'Configured Reply-To Email:' : 'Beállított válaszcím (Reply-To):'}</strong> <span style="color:#1E3A8A;font-weight:700;">${effectiveReplyTo}</span></div>
        <div style="font-size:12px;color:#64748b;margin-top:6px;">
          ${isEn
            ? 'When colleagues or residents reply to system messages, their replies will land in this mailbox.'
            : 'Amikor munkatársaid vagy a lakók a rendszerlevelekre válaszolnak a levelezőjükben, a válaszok közvetlenül ebbe a postafiókba érkeznek majd.'}
        </div>
      </div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin:0;">
        TarsasApp System Notification • ${new Date().toLocaleString()}
      </p>
    </div>
  `.trim();

  return sendTransactionalEmail({
    to: targetEmail,
    subject,
    html: htmlBody,
    text: textBody,
    from: effective.senderEmail,
    replyTo: effectiveReplyTo,
    senderName: effective.senderName || 'TarsasApp',
    provider: effective.provider,
    apiKey: effective.apiKey,
  });
}
