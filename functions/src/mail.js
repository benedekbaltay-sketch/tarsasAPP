/**
 * Server-Side Direct Mail & Correspondence Cloud Function (v2, europe-west1)
 *
 * Enforces strict RBAC recipient routing in Firestore mode:
 *   - Owner    -> ONLY building Admins (KK) (strictly blocked from messaging other owners)
 *   - SZVB     -> building Admins (KK) and/or Economic Auditor
 *   - Auditor  -> building Admins (KK) and/or SZVB
 *   - Admin    -> building members (direct reply or targeted message)
 *
 * Writes per-recipient copies to `users/{recipientUid}/notifications/{notifId}`
 * and a sender copy to `users/{senderUid}/notifications/{senderNotifId}`.
 * Attachments MUST be pre-uploaded to Cloud Storage under `buildings/{buildingId}/mail/...`.
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeAttachments(buildingId, rawList = []) {
  if (!Array.isArray(rawList)) return [];
  const prefix = `buildings/${buildingId}/mail/`;
  return rawList
    .filter((att) => att && typeof att === 'object' && typeof att.storagePath === 'string' && att.storagePath.startsWith(prefix))
    .slice(0, 8)
    .map((att, idx) => ({
      id: String(att.id || `matt-${idx + 1}`).slice(0, 80),
      fileName: String(att.fileName || att.name || 'document').slice(0, 180),
      fileType: String(att.fileType || 'file').slice(0, 32),
      fileSize: String(att.fileSize || '').slice(0, 32),
      mimeType: String(att.mimeType || 'application/octet-stream').slice(0, 120),
      storagePath: att.storagePath,
    }));
}

export const sendDirectMail = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const {
      buildingId,
      recipientMode = 'kk',
      replyToEmail = '',
      subject = '',
      body = '',
      attachments = [],
      senderRole = '',
      senderName = '',
      deliveryChannel = 'in_app',
      sendInApp = true,
    } = request.data || {};

    if (!buildingId || typeof buildingId !== 'string') {
      throw new HttpsError('invalid-argument', 'buildingId is required.');
    }
    const cleanSubject = String(subject || '').trim().slice(0, 200);
    const cleanBody = String(body || '').trim().slice(0, 10000);
    if (!cleanSubject || !cleanBody) {
      throw new HttpsError('invalid-argument', 'Subject and message body are required.');
    }

    const db = getFirestore();
    const callerUid = request.auth.uid;
    const callerEmail = normalizeEmail(request.auth.token?.email);
    const isSuperAdmin = request.auth.token?.superadmin === true;

    const [buildingSnap, callerMemberSnap, allMembersSnap] = await Promise.all([
      db.doc(`buildings/${buildingId}`).get(),
      db.doc(`buildings/${buildingId}/members/${callerUid}`).get(),
      db.collection(`buildings/${buildingId}/members`).where('active', '==', true).get(),
    ]);

    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', 'Building not found.');
    }

    const callerMember = callerMemberSnap.exists ? callerMemberSnap.data() : null;
    if (!isSuperAdmin && (!callerMember || callerMember.active !== true)) {
      throw new HttpsError('permission-denied', 'You are not an active member of this building.');
    }

    const bData = buildingSnap.data() || {};
    const bName = bData.name || buildingId;
    const activeMembers = allMembersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));

    // Determine effective sender role (strictly capped by actual server-verified membership)
    const effectiveRole = isSuperAdmin
      ? 'superadmin'
      : callerMember.role === 'admin'
        ? (['szvb', 'auditor', 'Owner', 'owner'].includes(senderRole) ? senderRole.toLowerCase() : 'admin')
        : callerMember.role === 'szvb'
          ? (senderRole === 'auditor' && callerMember.isEconomicAuditor ? 'auditor' : 'szvb')
          : callerMember.role === 'auditor'
            ? 'auditor'
            : 'owner';

    const adminMembers = activeMembers.filter((m) => m.role === 'admin');
    const szvbMembers = activeMembers.filter((m) => m.role === 'szvb');
    const auditorMembers = activeMembers.filter(
      (m) => m.role === 'auditor' || m.isEconomicAuditor === true
    );

    let targetMembers = [];
    const cleanReplyEmail = normalizeEmail(replyToEmail);

    if (effectiveRole === 'owner') {
      // Owners may ONLY write to Common Representative (KK / admin)
      targetMembers = adminMembers;
    } else if (effectiveRole === 'szvb') {
      if (recipientMode === 'auditor') targetMembers = auditorMembers;
      else if (recipientMode === 'kk_and_auditor') targetMembers = [...adminMembers, ...auditorMembers];
      else targetMembers = adminMembers;
    } else if (effectiveRole === 'auditor') {
      if (recipientMode === 'szvb') targetMembers = szvbMembers;
      else if (recipientMode === 'kk_and_szvb') targetMembers = [...adminMembers, ...szvbMembers];
      else targetMembers = adminMembers;
    } else {
      // Admin / SuperAdmin
      if (cleanReplyEmail) {
        targetMembers = activeMembers.filter((m) => normalizeEmail(m.email) === cleanReplyEmail);
      } else if (recipientMode === 'szvb') {
        targetMembers = szvbMembers;
      } else if (recipientMode === 'auditor') {
        targetMembers = auditorMembers;
      } else {
        targetMembers = adminMembers;
      }
    }

    // Deduplicate recipients by UID
    const recipientByUid = new Map();
    for (const m of targetMembers) {
      if (m && m.uid && m.uid !== callerUid) {
        recipientByUid.set(m.uid, m);
      }
    }

    const safeAttachments = sanitizeAttachments(buildingId, attachments);
    const nowTs = FieldValue.serverTimestamp();
    const resolvedSenderName = String(senderName || callerMember?.name || callerEmail || 'User').trim().slice(0, 120);
    const roleLabels = {
      admin: { hu: 'Közös Képviselet', en: 'Management' },
      superadmin: { hu: 'Rendszergazda', en: 'System Admin' },
      szvb: { hu: 'SZVB', en: 'SZVB' },
      auditor: { hu: 'Gazdasági ellenőr', en: 'Financial Auditor' },
      owner: { hu: 'Tulajdonos', en: 'Owner' },
    };
    const lbl = roleLabels[effectiveRole] || roleLabels.owner;

    const batch = db.batch();
    let deliveredCount = 0;

    if (sendInApp) {
      for (const [recUid, recMember] of recipientByUid.entries()) {
        const notifId = makeId('mail');
        batch.set(db.doc(`users/${recUid}/notifications/${notifId}`), {
          id: notifId,
          type: 'direct_message',
          severity: 'info',
          buildingId,
          buildingName: bName,
          recipientEmail: normalizeEmail(recMember.email),
          actorUid: callerUid,
          actorName: resolvedSenderName,
          actorEmail: callerEmail,
          titleHu: cleanSubject,
          titleEn: cleanSubject,
          messageHu: cleanBody,
          messageEn: cleanBody,
          attachments: safeAttachments,
          read: false,
          archived: false,
          deleted: false,
          dismissed: false,
          meta: {
            senderRole: effectiveRole,
            senderRoleLabelHu: lbl.hu,
            senderRoleLabelEn: lbl.en,
            deliveryChannel,
            isDirectMessage: true,
          },
          createdAt: nowTs,
        });
        deliveredCount += 1;
      }
    }

    // Always write sender's own Sent copy
    const senderNotifId = makeId('sent');
    const recipientNames = Array.from(recipientByUid.values())
      .map((m) => m.name || m.email)
      .filter(Boolean)
      .slice(0, 5)
      .join(', ');

    batch.set(db.doc(`users/${callerUid}/notifications/${senderNotifId}`), {
      id: senderNotifId,
      type: 'direct_message',
      severity: 'info',
      buildingId,
      buildingName: bName,
      recipientEmail: callerEmail,
      actorUid: callerUid,
      actorName: resolvedSenderName,
      actorEmail: callerEmail,
      titleHu: cleanSubject,
      titleEn: cleanSubject,
      messageHu: cleanBody,
      messageEn: cleanBody,
      attachments: safeAttachments,
      read: true,
      archived: false,
      deleted: false,
      dismissed: false,
      meta: {
        isSenderCopy: true,
        senderRole: effectiveRole,
        senderRoleLabelHu: lbl.hu,
        senderRoleLabelEn: lbl.en,
        recipientSummaryHu: recipientNames || bName,
        recipientSummaryEn: recipientNames || bName,
        deliveryChannel,
      },
      createdAt: nowTs,
    });

    await batch.commit();

    return {
      success: true,
      deliveredCount,
      senderNotifId,
    };
  }
);
