/**
 * Direct Messaging, Mail Attachments & Audit Opinion Correspondence Engine
 * Pure ES module (zero React/Firebase runtime dependencies) shared across UI, Context actions, and Node unit tests.
 */

import {
  normalizeEmail,
  buildNotification,
  findOrganizationForBuilding,
  canUserManageBuilding,
} from './teamPermissions.js';
import { normalizeBuildingSzvb, isUserBuildingSzvb } from './szvb.js';
import {
  isEconomicAuditorActive,
  isUserBuildingEconomicAuditor,
  AUDIT_OPINION_VERDICTS,
} from './economicAuditor.js';
import { sanitizeFileName } from './fileSecurity.js';

export const MAIL_INLINE_MAX_CHARS = 120_000;

/**
 * Strip heavy base64 payloads into lightweight attachment metadata for state/RTDB notifications.
 */
export function sanitizeMailAttachments(rawAttachments = []) {
  if (!Array.isArray(rawAttachments)) return [];
  return rawAttachments
    .filter((a) => a && (a.fileName || a.name))
    .slice(0, 8)
    .map((a, idx) => {
      const id = String(a.id || `matt-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
      const fileName = sanitizeFileName(a.fileName || a.name || `attachment_${idx + 1}`);
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : String(a.fileType || '').toLowerCase();
      const rawData = typeof a.fileData === 'string' ? a.fileData : (typeof a.inlineData === 'string' ? a.inlineData : '');
      const hasCloudFile = Boolean(a.hasCloudFile || a.storageKey || a.storagePath || rawData);
      return {
        id,
        fileName,
        fileType: ext || 'file',
        fileSize: String(a.fileSize || ''),
        mimeType: String(a.mimeType || ''),
        storageKey: String(a.storageKey || `condo_doc_files/mail/${id}`),
        storagePath: a.storagePath ? String(a.storagePath) : null,
        hasCloudFile,
        inlineData: rawData && rawData.length <= MAIL_INLINE_MAX_CHARS ? rawData : '',
      };
    });
}

/**
 * Resolve all managing KK (Common Representative) recipients for a building.
 */
export function resolveBuildingKkRecipients(building, organizations = [], users = []) {
  if (!building) return [];
  const byEmail = new Map();

  const addRec = (email, name) => {
    const clean = normalizeEmail(email);
    if (!clean) return;
    if (!byEmail.has(clean)) {
      byEmail.set(clean, {
        email: clean,
        name: String(name || clean).trim(),
        role: 'kk',
        targetProfile: { type: 'kk', buildingId: building.id || null },
      });
    }
  };

  if (building.managerContact?.email) {
    addRec(building.managerContact.email, building.managerContact.name || building.name);
  }

  const org = findOrganizationForBuilding(building, organizations || []);
  if (org) {
    if (org.ownerEmail) {
      addRec(org.ownerEmail, org.ownerName || org.name || 'Közös Képviselet');
    }
    (org.members || []).forEach((m) => {
      if (!m || m.active === false || m.status === 'suspended' || !m.email) return;
      const hasAccess =
        m.orgRole === 'owner' ||
        m.buildingScope === 'all' ||
        (Array.isArray(m.buildingIds) && m.buildingIds.includes(building.id));
      if (hasAccess) {
        addRec(m.email, m.name || org.name || m.email);
      }
    });
  } else {
    // Legacy single-admin fallback when no org exists yet
    (users || []).forEach((u) => {
      if (u && (u.role === 'admin' || u.role === 'superadmin') && u.email) {
        addRec(u.email, u.name || u.email);
      }
    });
  }

  return Array.from(byEmail.values());
}

/**
 * Resolve all SZVB members with a valid email for a building.
 */
export function resolveBuildingSzvbRecipients(building) {
  if (!building) return [];
  const norm = normalizeBuildingSzvb(building);
  const list = [
    ...(norm.chairperson ? [{ ...norm.chairperson, szvbRole: 'chairperson' }] : []),
    ...(norm.members || []).map((m) => ({ ...m, szvbRole: 'member' })),
  ];
  const byEmail = new Map();
  list.forEach((p) => {
    const clean = normalizeEmail(p.email);
    if (!clean || byEmail.has(clean)) return;
    byEmail.set(clean, {
      email: clean,
      name: String(p.name || clean).trim(),
      flatNum: p.flatNum ? String(p.flatNum) : null,
      szvbRole: p.szvbRole,
      // SZVB members receive building oversight correspondence in their SZVB profile
      targetProfile: { type: 'szvb', buildingId: building.id || null, flatNum: p.flatNum ? String(p.flatNum) : null },
    });
  });
  return Array.from(byEmail.values());
}

/**
 * Resolve the active Economic Auditor recipient for a building, if any.
 */
export function resolveBuildingAuditorRecipient(building) {
  if (!building?.economicAuditor || !isEconomicAuditorActive(building.economicAuditor)) {
    return null;
  }
  const aud = building.economicAuditor;
  const clean = normalizeEmail(aud.email);
  if (!clean) return null;
  return {
    email: clean,
    name: String(aud.name || clean).trim(),
    type: aud.type === 'internal' ? 'internal' : 'external',
    flatNum: aud.type === 'internal' && aud.flatNum ? String(aud.flatNum) : null,
    targetProfile: { type: 'auditor', buildingId: building.id || null, flatNum: null },
  };
}

/**
 * Resolve sender profile metadata for the currently active user session.
 */
export function resolveSenderProfile(actorUser, buildingId = null) {
  if (!actorUser) return null;
  const role = actorUser.role;
  if (role === 'admin' || role === 'superadmin') {
    return { type: 'kk', buildingId: buildingId || null, flatNum: null };
  }
  if (role === 'szvb') {
    return { type: 'szvb', buildingId: buildingId || actorUser.buildingId || null, flatNum: actorUser.flatNum || null };
  }
  if (role === 'auditor') {
    return { type: 'auditor', buildingId: buildingId || actorUser.buildingId || null, flatNum: actorUser.flatNum || null };
  }
  return {
    type: 'owner',
    buildingId: buildingId || actorUser.buildingId || null,
    flatNum: actorUser.flatNum ? String(actorUser.flatNum) : null,
  };
}

/**
 * Build role-validated direct message notifications + sender-side Sent copy + optional synced audit opinion.
 * Enforces strict permission isolation:
 *   - Residents (Owner/Tenant) can message their building's Common Representative (KK) and/or individually selected verified SZVB members of their building (strictly blocked from arbitrary other residents or auditors).
 *   - SZVB can message KK and/or active Economic Auditor of their building.
 *   - Economic Auditor can message KK and/or SZVB of their building, and submit Official Written Opinions (Tht. 51/A. §).
 *   - KK can message/reply to Residents, SZVB, or Economic Auditor on buildings they manage.
 */
export function buildDirectMessagePayload({
  actorUser,
  building,
  organizations = [],
  users = [],
  buildings = [],
  recipientMode = 'kk',
  includeKk = true,
  selectedSzvbEmails = [],
  replyToNotif = null,
  subject = '',
  body = '',
  category = 'general',
  attachments = [],
  auditOpinionMeta = null,
  deliveryChannel = 'in_app',
}) {
  if (!actorUser || !building) {
    return { ok: false, error: 'missing-context' };
  }

  const cleanSubject = String(subject || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanSubject || !cleanBody) {
    return { ok: false, error: 'missing-content' };
  }

  const role = actorUser.role;
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSzvb = role === 'szvb';
  const isAuditor = role === 'auditor';
  const isResident = !isAdmin && !isSzvb && !isAuditor;

  // Fail-closed authorization checks
  if (isAdmin && !canUserManageBuilding(actorUser, building, organizations, buildings.length > 0 ? buildings : [building])) {
    return { ok: false, error: 'permission-denied' };
  }
  if (isSzvb && !isUserBuildingSzvb(actorUser, building)) {
    return { ok: false, error: 'permission-denied' };
  }
  if (isAuditor && !isUserBuildingEconomicAuditor(actorUser, building)) {
    return { ok: false, error: 'permission-denied' };
  }

  const senderEmail = normalizeEmail(actorUser.email || actorUser.username || '');
  const senderProfile = resolveSenderProfile(actorUser, building.id);
  const safeAttachments = sanitizeMailAttachments(attachments);
  const bName = building.name || 'Társasház';

  let recipients = [];
  let recipientSummaryHu = '';
  let recipientSummaryEn = '';

  if (replyToNotif && replyToNotif.actorEmail && normalizeEmail(replyToNotif.actorEmail) !== senderEmail) {
    // Direct reply to an incoming letter
    const replyEmail = normalizeEmail(replyToNotif.actorEmail);
    const replyName = replyToNotif.actorName || replyEmail;
    const replyProfile = replyToNotif.meta?.senderProfile || null;

    if (isResident) {
      // Residents may ONLY reply to KK or verified SZVB members of their own building
      const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
      const szvbRecs = resolveBuildingSzvbRecipients(building);
      const isTargetKk = kkRecs.some((r) => r.email === replyEmail) || replyProfile?.type === 'kk';
      const matchedSzvb = szvbRecs.find((r) => r.email === replyEmail);
      if (!isTargetKk && !matchedSzvb) {
        return { ok: false, error: 'resident-kk-szvb-only' };
      }
      if (matchedSzvb && replyProfile?.type === 'szvb') {
        recipients = [matchedSzvb];
        recipientSummaryHu = `${matchedSzvb.name} (${matchedSzvb.szvbRole === 'chairperson' ? 'SZVB Elnök' : 'SZVB Tag'})`;
        recipientSummaryEn = `${matchedSzvb.name} (${matchedSzvb.szvbRole === 'chairperson' ? 'SZVB Chairperson' : 'SZVB Member'})`;
      } else if (isTargetKk) {
        recipients = kkRecs.length > 0 ? kkRecs : [{ email: replyEmail, name: replyName, targetProfile: { type: 'kk', buildingId: building.id } }];
        recipientSummaryHu = 'Közös Képviselet (KK)';
        recipientSummaryEn = 'Common Representative (Management)';
      } else {
        recipients = [matchedSzvb];
        recipientSummaryHu = `${matchedSzvb.name} (${matchedSzvb.szvbRole === 'chairperson' ? 'SZVB Elnök' : 'SZVB Tag'})`;
        recipientSummaryEn = `${matchedSzvb.name} (${matchedSzvb.szvbRole === 'chairperson' ? 'SZVB Chairperson' : 'SZVB Member'})`;
      }
    } else {
      recipients = [
        {
          email: replyEmail,
          name: replyName,
          flatNum: replyToNotif.meta?.senderFlatNum || replyToNotif.flatNum || null,
          targetProfile: replyProfile || { type: 'any', buildingId: building.id },
        },
      ];
      recipientSummaryHu = replyName;
      recipientSummaryEn = replyName;
    }
  } else if (isResident) {
    // Resident -> KK and/or individually selected verified SZVB members of their own building
    const allowedResidentModes = ['kk', 'szvb', 'kk_and_szvb', 'custom'];
    if (recipientMode && !allowedResidentModes.includes(recipientMode)) {
      return { ok: false, error: 'resident-kk-szvb-only' };
    }
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const allSzvbRecs = resolveBuildingSzvbRecipients(building);
    const cleanSelectedSzvb = Array.isArray(selectedSzvbEmails)
      ? Array.from(new Set(selectedSzvbEmails.map((e) => normalizeEmail(e)).filter(Boolean)))
      : [];

    const wantKk =
      recipientMode === 'kk' ||
      (recipientMode === 'kk_and_szvb' && includeKk !== false) ||
      (recipientMode === 'custom' && Boolean(includeKk));
    const wantSzvb =
      recipientMode === 'szvb' ||
      recipientMode === 'kk_and_szvb' ||
      (recipientMode === 'custom' && cleanSelectedSzvb.length > 0);

    const chosenSzvb = wantSzvb
      ? (cleanSelectedSzvb.length > 0
          ? allSzvbRecs.filter((r) => cleanSelectedSzvb.includes(r.email))
          : allSzvbRecs)
      : [];

    recipients = [
      ...(wantKk ? kkRecs : []),
      ...chosenSzvb,
    ];

    const summaryPartsHu = [];
    const summaryPartsEn = [];
    if (wantKk && kkRecs.length > 0) {
      summaryPartsHu.push('Közös Képviselet (KK)');
      summaryPartsEn.push('Common Representative (KK)');
    }
    chosenSzvb.forEach((s) => {
      const rHu = s.szvbRole === 'chairperson' ? 'SZVB Elnök' : 'SZVB Tag';
      const rEn = s.szvbRole === 'chairperson' ? 'SZVB Chairperson' : 'SZVB Member';
      summaryPartsHu.push(`${s.name} (${rHu})`);
      summaryPartsEn.push(`${s.name} (${rEn})`);
    });
    recipientSummaryHu = summaryPartsHu.join(', ') || 'Közös Képviselet (KK)';
    recipientSummaryEn = summaryPartsEn.join(', ') || 'Common Representative (KK)';
  } else if (isSzvb) {
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const audRec = resolveBuildingAuditorRecipient(building);
    if (recipientMode === 'auditor') {
      recipients = audRec ? [audRec] : [];
      recipientSummaryHu = audRec ? `Gazdasági ellenőr (${audRec.name})` : 'Gazdasági ellenőr';
      recipientSummaryEn = audRec ? `Financial Auditor (${audRec.name})` : 'Financial Auditor';
    } else if (recipientMode === 'kk_and_auditor') {
      recipients = [...kkRecs, ...(audRec ? [audRec] : [])];
      recipientSummaryHu = audRec ? 'Közös Képviselet & Gazdasági ellenőr' : 'Közös Képviselet (KK)';
      recipientSummaryEn = audRec ? 'Management & Financial Auditor' : 'Common Representative (Management)';
    } else {
      recipients = kkRecs;
      recipientSummaryHu = 'Közös Képviselet (KK)';
      recipientSummaryEn = 'Common Representative (Management)';
    }
  } else if (isAuditor) {
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const szvbRecs = resolveBuildingSzvbRecipients(building);
    if (recipientMode === 'kk') {
      recipients = kkRecs;
      recipientSummaryHu = 'Közös Képviselet (KK)';
      recipientSummaryEn = 'Common Representative (Management)';
    } else if (recipientMode === 'szvb') {
      recipients = szvbRecs;
      recipientSummaryHu = 'Számvizsgáló Bizottság (SZVB)';
      recipientSummaryEn = 'Accounting Committee (SZVB)';
    } else {
      recipients = [...kkRecs, ...szvbRecs];
      recipientSummaryHu = szvbRecs.length > 0 ? 'Közös Képviselet & SZVB' : 'Közös Képviselet (KK)';
      recipientSummaryEn = szvbRecs.length > 0 ? 'Management & SZVB' : 'Common Representative (Management)';
    }
  } else if (isAdmin) {
    const szvbRecs = resolveBuildingSzvbRecipients(building);
    const audRec = resolveBuildingAuditorRecipient(building);
    if (recipientMode === 'auditor') {
      recipients = audRec ? [audRec] : [];
      recipientSummaryHu = audRec ? `Gazdasági ellenőr (${audRec.name})` : 'Gazdasági ellenőr';
      recipientSummaryEn = audRec ? `Financial Auditor (${audRec.name})` : 'Financial Auditor';
    } else if (recipientMode === 'szvb') {
      recipients = szvbRecs;
      recipientSummaryHu = 'Számvizsgáló Bizottság (SZVB)';
      recipientSummaryEn = 'Accounting Committee (SZVB)';
    } else if (recipientMode === 'szvb_and_auditor') {
      recipients = [...szvbRecs, ...(audRec ? [audRec] : [])];
      recipientSummaryHu = 'SZVB & Gazdasági ellenőr';
      recipientSummaryEn = 'SZVB & Financial Auditor';
    }
  }

  // Deduplicate by email + targetProfile.type so multi-profile accounts (e.g. same email in KK & SZVB) receive each in its own profile!
  const uniqueMap = new Map();
  recipients.forEach((r) => {
    if (!r || !r.email) return;
    const pType = r.targetProfile?.type || 'any';
    const key = `${r.email}::${pType}::${r.targetProfile?.flatNum || ''}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, r);
    }
  });
  const finalRecipients = Array.from(uniqueMap.values());

  if (finalRecipients.length === 0) {
    return { ok: false, error: 'no-recipients' };
  }

  const isOfficialOpinion = Boolean(isAuditor && auditOpinionMeta?.isOfficialOpinion);
  const isAuditObservation = Boolean(isAuditor && auditOpinionMeta?.isObservation);
  const opinionYear = isOfficialOpinion ? (Number(auditOpinionMeta.year) || new Date().getFullYear() - 1) : null;
  const opinionVerdict = isOfficialOpinion
    ? (AUDIT_OPINION_VERDICTS.includes(auditOpinionMeta.verdict) ? auditOpinionMeta.verdict : 'approved')
    : null;
  const obsSeverity = isAuditObservation
    ? (['info', 'warning', 'critical'].includes(auditOpinionMeta.severity) ? auditOpinionMeta.severity : 'warning')
    : null;

  const notifType = isOfficialOpinion
    ? 'audit_opinion'
    : isAuditObservation
    ? 'audit_observation'
    : 'direct_message';

  const notifSeverity = isAuditObservation
    ? obsSeverity
    : category === 'urgent'
    ? 'critical'
    : isOfficialOpinion && opinionVerdict === 'rejected'
    ? 'warning'
    : 'info';

  const senderRoleLabelHu = isAdmin
    ? 'Közös Képviselet'
    : isAuditor
    ? 'Gazdasági ellenőr'
    : isSzvb
    ? 'SZVB'
    : `${actorUser.flatNum ? `${actorUser.flatNum}. lakás tulajdonosa` : 'Tulajdonos'}`;
  const senderRoleLabelEn = isAdmin
    ? 'Management (KK)'
    : isAuditor
    ? 'Financial Auditor'
    : isSzvb
    ? 'SZVB'
    : `${actorUser.flatNum ? `Flat #${actorUser.flatNum} Owner` : 'Owner'}`;

  const sharedMeta = {
    directMessage: true,
    category: category || 'general',
    deliveryChannel: deliveryChannel || 'in_app',
    senderRole: role,
    senderRoleLabelHu,
    senderRoleLabelEn,
    senderFlatNum: actorUser.flatNum ? String(actorUser.flatNum) : null,
    senderProfile,
    recipientSummaryHu,
    recipientSummaryEn,
    recipientCount: finalRecipients.length,
    ...(replyToNotif?.id ? { replyToId: replyToNotif.id } : {}),
    ...(isOfficialOpinion
      ? {
          isOfficialOpinion: true,
          year: opinionYear,
          verdict: opinionVerdict,
        }
      : {}),
    ...(isAuditObservation
      ? {
          isAuditObservation: true,
          severity: obsSeverity,
        }
      : {}),
  };

  const recipientNotifications = finalRecipients.map((r) =>
    buildNotification({
      type: notifType,
      severity: notifSeverity,
      recipientEmail: r.email,
      buildingId: building.id,
      buildingName: bName,
      flatNum: r.flatNum || null,
      targetProfile: r.targetProfile,
      actorUser,
      titleHu: cleanSubject,
      titleEn: cleanSubject,
      messageHu: cleanBody,
      messageEn: cleanBody,
      attachments: safeAttachments,
      meta: sharedMeta,
    })
  );

  // Sender's own copy (stored cleanly for their Sent tab & independent archiving, never unread)
  const senderCopyNotification = buildNotification({
    type: notifType,
    severity: notifSeverity,
    recipientEmail: senderEmail,
    buildingId: building.id,
    buildingName: bName,
    flatNum: actorUser.flatNum ? String(actorUser.flatNum) : null,
    targetProfile: senderProfile,
    actorUser,
    titleHu: cleanSubject,
    titleEn: cleanSubject,
    messageHu: cleanBody,
    messageEn: cleanBody,
    attachments: safeAttachments,
    read: true,
    meta: {
      ...sharedMeta,
      isSenderCopy: true,
    },
  });

  // If Financial Auditor submitted an Official Written Opinion via Mail, sync it into building.auditOpinions too!
  let syncedAuditOpinion = null;
  if (isOfficialOpinion) {
    const firstAtt = safeAttachments[0] || null;
    syncedAuditOpinion = {
      id: `aop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      year: opinionYear,
      title: cleanSubject,
      summary: cleanBody,
      verdict: opinionVerdict,
      fileName: firstAtt ? firstAtt.fileName : '',
      fileType: firstAtt ? firstAtt.fileType : '',
      fileSize: firstAtt ? firstAtt.fileSize : '',
      hasCloudFile: Boolean(firstAtt?.hasCloudFile),
      fileData: firstAtt?.inlineData || '',
      mailAttachmentStorageKey: firstAtt?.storageKey || null,
      authorName: actorUser.name || building.economicAuditor?.name || senderEmail,
      authorEmail: senderEmail,
      authorRole: 'auditor',
      publishedToOwners: false,
      createdAt: new Date().toISOString(),
      source: 'mail',
    };
  }

  return {
    ok: true,
    recipientNotifications,
    senderCopyNotification,
    syncedAuditOpinion,
    recipients: finalRecipients,
    attachments: safeAttachments,
  };
}
