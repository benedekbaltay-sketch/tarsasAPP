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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves a resident/user's verified configured email address from their active profile or owned flat.
 * Returns normalized email string if valid, or '' if no valid email is configured.
 */
export function resolveResidentProfileEmail(actorUser, building = null) {
  if (!actorUser) return '';
  const direct = normalizeEmail(actorUser.email || '');
  if (direct && EMAIL_RE.test(direct)) return direct;

  if (building && Array.isArray(building.flats) && actorUser.flatNum) {
    const flat = building.flats.find((f) => f && String(f.flatNum) === String(actorUser.flatNum));
    if (flat) {
      const flatEmail = normalizeEmail(flat.email || '');
      if (flatEmail && EMAIL_RE.test(flatEmail)) return flatEmail;
      if (Array.isArray(flat.owners)) {
        for (const o of flat.owners) {
          const oe = normalizeEmail(o?.email || (Array.isArray(o?.emails) ? o.emails[0] : ''));
          if (oe && EMAIL_RE.test(oe)) return oe;
        }
      }
    }
  }
  return '';
}

/**
 * Resolves a stable conversation thread identifier for Gmail/Outlook-style message threading.
 */
export function resolveMessageThreadId(notif) {
  if (!notif) return '';
  if (notif.threadId) return String(notif.threadId);
  if (notif.meta?.threadId) return String(notif.meta.threadId);
  if (notif.meta?.replyToId) return String(notif.meta.replyToId);
  return String(notif.id || '');
}

/**
 * Returns all non-deleted messages belonging to the same conversation thread (both received and sent),
 * sorted chronologically from oldest to newest (Gmail / Outlook conversation chain order).
 */
export function getConversationThreadMessages(allProfileNotifs = [], targetNotif = null) {
  if (!targetNotif) return [];
  const targetThreadId = resolveMessageThreadId(targetNotif);
  const targetId = String(targetNotif.id || '');
  const list = Array.isArray(allProfileNotifs) ? allProfileNotifs : [];

  const matched = new Map();
  const add = (n) => {
    if (!n || !n.id || n.deleted) return;
    matched.set(n.id, n);
  };

  add(targetNotif);
  for (const n of list) {
    if (!n || n.deleted) continue;
    const nThreadId = resolveMessageThreadId(n);
    if (
      (targetThreadId && nThreadId === targetThreadId) ||
      (targetId && (n.id === targetId || n.meta?.replyToId === targetId)) ||
      (targetNotif.meta?.replyToId && n.id === targetNotif.meta.replyToId)
    ) {
      add(n);
    }
  }

  return Array.from(matched.values()).sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
}

/**
 * Groups direct-message notifications in a tab list by conversation threadId so each conversation
 * renders as one row with the latest message preview, total chain count, and unread indicator.
 */
export function groupNotificationsByThread(tabList = [], allProfileNotifs = []) {
  const list = Array.isArray(tabList) ? tabList : [];
  const threadBuckets = new Map();
  const orderedKeys = [];

  for (const notif of list) {
    if (!notif || notif.deleted) continue;
    const isThreadable = Boolean(
      notif.threadId ||
      notif.meta?.threadId ||
      notif.meta?.directMessage ||
      notif.meta?.isDirectMessage ||
      notif.type === 'direct_message' ||
      notif.type === 'audit_opinion' ||
      notif.type === 'audit_observation'
    );
    const key = isThreadable ? `thread:${resolveMessageThreadId(notif)}` : `single:${notif.id}`;
    if (!threadBuckets.has(key)) {
      threadBuckets.set(key, []);
      orderedKeys.push(key);
    }
    threadBuckets.get(key).push(notif);
  }

  return orderedKeys.map((key) => {
    const items = threadBuckets.get(key) || [];
    // Sort newest first inside the tab bucket
    items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const latest = items[0];
    const fullChain = key.startsWith('thread:')
      ? getConversationThreadMessages(allProfileNotifs.length > 0 ? allProfileNotifs : list, latest)
      : [latest];
    const hasUnread = items.some((n) => !n.read && !n.meta?.isSenderCopy);
    return {
      key,
      latest,
      threadCount: fullChain.length,
      fullChain,
      hasUnread,
    };
  });
}

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
 * Resolve all resident owner recipients across a building's flats (for SZVB announcements
 * bypassing management, with strictly individual/private delivery — never exposing resident emails).
 */
export function resolveBuildingResidentRecipients(building) {
  if (!building || !Array.isArray(building.flats)) return [];
  const results = [];
  const seen = new Set();
  const add = (email, name, flatNum) => {
    const clean = normalizeEmail(email);
    if (!clean || !EMAIL_RE.test(clean)) return;
    const fNum = flatNum ? String(flatNum) : null;
    const key = `${clean}::${fNum || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      email: clean,
      name: String(name || clean).trim(),
      flatNum: fNum,
      targetProfile: { type: 'owner', buildingId: building.id || null, flatNum: fNum },
    });
  };

  for (const flat of building.flats) {
    if (!flat) continue;
    const fNum = flat.flatNum ? String(flat.flatNum) : null;
    if (Array.isArray(flat.owners) && flat.owners.length > 0) {
      for (const o of flat.owners) {
        if (!o) continue;
        if (o.email) add(o.email, o.name || flat.ownerName, fNum);
        if (Array.isArray(o.emails)) {
          o.emails.forEach((em) => add(em, o.name || flat.ownerName, fNum));
        }
      }
    }
    if (flat.email) {
      add(flat.email, flat.ownerName || `${fNum || ''}. lakás`, fNum);
    }
  }
  return results;
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

  // Non-admin senders (Residents, SZVB, Auditor) MUST have a valid configured email to send via Email ('email' or 'both')
  const senderProfileEmail = (isResident || isSzvb)
    ? resolveResidentProfileEmail(actorUser, building)
    : normalizeEmail(actorUser.email || actorUser.username || '');
  if ((isResident || isSzvb) && (deliveryChannel === 'email' || deliveryChannel === 'both') && !senderProfileEmail) {
    return { ok: false, error: 'sender-email-required' };
  }

  const senderEmail = senderProfileEmail || normalizeEmail(actorUser.email || actorUser.username || '');
  const senderProfile = resolveSenderProfile(actorUser, building.id);
  const safeAttachments = sanitizeMailAttachments(attachments);
  const bName = building.name || 'Társasház';
  const threadId =
    (replyToNotif ? resolveMessageThreadId(replyToNotif) : '') ||
    `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let recipients = [];
  let recipientSummaryHu = '';
  let recipientSummaryEn = '';

  if (replyToNotif && replyToNotif.actorEmail && normalizeEmail(replyToNotif.actorEmail) !== senderEmail) {
    // Direct reply to an incoming letter
    const replyEmail = normalizeEmail(replyToNotif.actorEmail);
    const replyName = replyToNotif.actorName || replyEmail;
    const replyProfile = replyToNotif.meta?.senderProfile || null;

    if (isResident) {
      // Residents may ONLY reply to KK or SZVB of their own building
      const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
      const szvbRecs = resolveBuildingSzvbRecipients(building);
      const isTargetKk = kkRecs.some((r) => r.email === replyEmail) || replyProfile?.type === 'kk';
      const isTargetSzvb = szvbRecs.some((r) => r.email === replyEmail) || replyProfile?.type === 'szvb';
      if (!isTargetKk && !isTargetSzvb) {
        return { ok: false, error: 'resident-kk-szvb-only' };
      }
      if (isTargetSzvb && (replyProfile?.type === 'szvb' || !isTargetKk)) {
        // Council-wide delivery to the entire SZVB committee
        recipients = szvbRecs;
        recipientSummaryHu = 'Számvizsgáló Bizottság (SZVB)';
        recipientSummaryEn = 'Accounting Committee (SZVB)';
      } else {
        recipients = kkRecs.length > 0 ? kkRecs : [{ email: replyEmail, name: replyName, targetProfile: { type: 'kk', buildingId: building.id } }];
        recipientSummaryHu = 'Közös Képviselet (KK)';
        recipientSummaryEn = 'Common Representative (Management)';
      }
    } else if (isAuditor) {
      // STRICT RULE: Financial Auditor -> Residents is FORBIDDEN!
      // Auditor may ONLY reply to KK or SZVB.
      const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
      const szvbRecs = resolveBuildingSzvbRecipients(building);
      const isTargetKk = kkRecs.some((r) => r.email === replyEmail) || replyProfile?.type === 'kk';
      const isTargetSzvb = szvbRecs.some((r) => r.email === replyEmail) || replyProfile?.type === 'szvb';
      if (!isTargetKk && !isTargetSzvb) {
        return { ok: false, error: 'auditor-kk-szvb-only' };
      }
      if (isTargetSzvb && (replyProfile?.type === 'szvb' || !isTargetKk)) {
        recipients = szvbRecs;
        recipientSummaryHu = 'Számvizsgáló Bizottság (SZVB)';
        recipientSummaryEn = 'Accounting Committee (SZVB)';
      } else {
        recipients = kkRecs.length > 0 ? kkRecs : [{ email: replyEmail, name: replyName, targetProfile: { type: 'kk', buildingId: building.id } }];
        recipientSummaryHu = 'Közös Képviselet (KK)';
        recipientSummaryEn = 'Common Representative (Management)';
      }
    } else {
      // SZVB & KK may reply to any valid sender (including individual residents, SZVB, Auditor, KK)
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
    // Resident -> KK and/or the ENTIRE SZVB committee of their own building (never individual cherry-picking, Auditor, or other Residents)
    const allowedResidentModes = ['kk', 'szvb', 'kk_and_szvb', 'custom'];
    if (recipientMode && !allowedResidentModes.includes(recipientMode)) {
      return { ok: false, error: 'resident-kk-szvb-only' };
    }
    if (includeAuditor || includeResidents) {
      return { ok: false, error: 'resident-kk-szvb-only' };
    }
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const allSzvbRecs = resolveBuildingSzvbRecipients(building);

    const wantKk =
      recipientMode === 'kk' ||
      (recipientMode === 'kk_and_szvb' && includeKk !== false) ||
      (recipientMode === 'custom' && Boolean(includeKk));
    const wantSzvb =
      recipientMode === 'szvb' ||
      recipientMode === 'kk_and_szvb' ||
      Boolean(includeSzvb) ||
      (Array.isArray(selectedSzvbEmails) && selectedSzvbEmails.length > 0);

    recipients = [
      ...(wantKk ? kkRecs : []),
      ...(wantSzvb ? allSzvbRecs : []),
    ];

    const summaryPartsHu = [];
    const summaryPartsEn = [];
    if (wantKk && kkRecs.length > 0) {
      summaryPartsHu.push('Közös Képviselet (KK)');
      summaryPartsEn.push('Common Representative (KK)');
    }
    if (wantSzvb && allSzvbRecs.length > 0) {
      summaryPartsHu.push('Számvizsgáló Bizottság (SZVB)');
      summaryPartsEn.push('Accounting Committee (SZVB)');
    }
    recipientSummaryHu = summaryPartsHu.join(', ') || 'Közös Képviselet (KK)';
    recipientSummaryEn = summaryPartsEn.join(', ') || 'Common Representative (KK)';
  } else if (isSzvb) {
    // SZVB -> KK, Financial Auditor, and/or All Residents (committee announcements bypassing KK with hidden/individual BCC delivery)
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const audRec = resolveBuildingAuditorRecipient(building);
    const residentRecs = resolveBuildingResidentRecipients(building);

    const wantKk =
      recipientMode === 'kk' ||
      (recipientMode === 'kk_and_auditor' && includeKk !== false) ||
      (recipientMode === 'custom' && Boolean(includeKk));
    const wantAuditor =
      recipientMode === 'auditor' ||
      recipientMode === 'kk_and_auditor' ||
      Boolean(includeAuditor);
    const wantResidents =
      recipientMode === 'residents' ||
      recipientMode === 'all_owners' ||
      Boolean(includeResidents);

    recipients = [
      ...(wantKk ? kkRecs : []),
      ...(wantAuditor && audRec ? [audRec] : []),
      ...(wantResidents ? residentRecs : []),
    ];

    const partsHu = [];
    const partsEn = [];
    if (wantKk && kkRecs.length > 0) {
      partsHu.push('Közös Képviselet (KK)');
      partsEn.push('Common Representative (KK)');
    }
    if (wantAuditor && audRec) {
      partsHu.push(`Gazdasági ellenőr (${audRec.name})`);
      partsEn.push(`Financial Auditor (${audRec.name})`);
    }
    if (wantResidents && residentRecs.length > 0) {
      partsHu.push(`Összes tulajdonos / Lakók (${residentRecs.length})`);
      partsEn.push(`All Residents / Owners (${residentRecs.length})`);
    }
    recipientSummaryHu = partsHu.join(', ') || 'Közös Képviselet (KK)';
    recipientSummaryEn = partsEn.join(', ') || 'Common Representative (KK)';
  } else if (isAuditor) {
    // STRICT RULE: Financial Auditor -> ONLY KK and/or SZVB (NEVER Residents/Owners!)
    const allowedAuditorModes = ['kk', 'szvb', 'kk_and_szvb', 'custom'];
    if ((recipientMode && !allowedAuditorModes.includes(recipientMode)) || includeResidents) {
      return { ok: false, error: 'auditor-kk-szvb-only' };
    }
    const kkRecs = resolveBuildingKkRecipients(building, organizations, users);
    const szvbRecs = resolveBuildingSzvbRecipients(building);
    const wantKk =
      recipientMode === 'kk' ||
      (recipientMode === 'kk_and_szvb' && includeKk !== false) ||
      (recipientMode === 'custom' && Boolean(includeKk));
    const wantSzvb =
      recipientMode === 'szvb' ||
      recipientMode === 'kk_and_szvb' ||
      Boolean(includeSzvb);

    recipients = [
      ...(wantKk ? kkRecs : []),
      ...(wantSzvb ? szvbRecs : []),
    ];
    const partsHu = [];
    const partsEn = [];
    if (wantKk && kkRecs.length > 0) {
      partsHu.push('Közös Képviselet (KK)');
      partsEn.push('Common Representative (KK)');
    }
    if (wantSzvb && szvbRecs.length > 0) {
      partsHu.push('Számvizsgáló Bizottság (SZVB)');
      partsEn.push('Accounting Committee (SZVB)');
    }
    recipientSummaryHu = partsHu.join(', ') || 'Közös Képviselet (KK)';
    recipientSummaryEn = partsEn.join(', ') || 'Common Representative (KK)';
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
    threadId,
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

  const recipientNotifications = finalRecipients.map((r) => ({
    ...buildNotification({
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
    }),
    threadId,
  }));

  // Sender's own copy (stored cleanly for their Sent tab & independent archiving, never unread)
  const senderCopyNotification = {
    ...buildNotification({
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
    }),
    threadId,
  };

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
    threadId,
    recipientNotifications,
    senderCopyNotification,
    syncedAuditOpinion,
    recipients: finalRecipients,
    attachments: safeAttachments,
  };
}
