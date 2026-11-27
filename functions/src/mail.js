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
      includeKk = true,
      includeSzvb = false,
      selectedSzvbEmails = [],
      replyToEmail = '',
      replyToProfileType = '',
      replyToFlatNum = null,
      threadId = '',
      replyToId = null,
      subject = '',
      body = '',
      attachments = [],
      senderRole = '',
      senderName = '',
      senderFlatNum = null,
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
    // Match SZVB members from BOTH building membership role='szvb' AND canonical building.szvb list
    const canonicalSzvbEmails = new Set();
    if (bData.szvb?.chairperson?.email) canonicalSzvbEmails.add(normalizeEmail(bData.szvb.chairperson.email));
    if (Array.isArray(bData.szvb?.members)) {
      bData.szvb.members.forEach((sm) => {
        if (sm?.email) canonicalSzvbEmails.add(normalizeEmail(sm.email));
      });
    }
    const szvbMembers = activeMembers.filter(
      (m) => m.role === 'szvb' || canonicalSzvbEmails.has(normalizeEmail(m.email))
    );
    const auditorMembers = activeMembers.filter(
      (m) => m.role === 'auditor' || m.isEconomicAuditor === true
    );

    const cleanSelectedSzvb = Array.isArray(selectedSzvbEmails)
      ? new Set(selectedSzvbEmails.map((e) => normalizeEmail(e)).filter(Boolean))
      : new Set();

    // Track { member, targetProfileType, targetFlatNum } so multi-profile users receive each letter in the right profile!
    const targetEntries = [];
    const pushTargets = (list, profileType, flatNumOverride = null) => {
      for (const m of list) {
        if (m && m.uid) targetEntries.push({ member: m, profileType, flatNum: flatNumOverride || null });
      }
    };
    const cleanReplyEmail = normalizeEmail(replyToEmail);
    const resolvedThreadId = String(threadId || replyToId || makeId('thread')).slice(0, 120);

    if (effectiveRole === 'owner') {
      // Owners may ONLY write to Common Representative (KK) and/or the ENTIRE SZVB committee
      if (cleanReplyEmail) {
        const isReplyKk = adminMembers.some((m) => normalizeEmail(m.email) === cleanReplyEmail) || replyToProfileType === 'kk';
        const isReplySzvb = szvbMembers.some((m) => normalizeEmail(m.email) === cleanReplyEmail) || replyToProfileType === 'szvb';
        if (isReplySzvb && (replyToProfileType === 'szvb' || !isReplyKk)) {
          pushTargets(szvbMembers, 'szvb');
        } else if (isReplyKk) {
          pushTargets(adminMembers, 'kk');
        }
        if (targetEntries.length === 0) {
          throw new HttpsError('permission-denied', 'Residents may only reply to Management (KK) or SZVB.');
        }
      } else {
        const allowedOwnerModes = ['kk', 'szvb', 'kk_and_szvb', 'custom'];
        if (!allowedOwnerModes.includes(recipientMode)) {
          throw new HttpsError('permission-denied', 'Residents may only message Management (KK) or SZVB.');
        }
        const wantKk =
          recipientMode === 'kk' ||
          (recipientMode === 'kk_and_szvb' && includeKk !== false) ||
          (recipientMode === 'custom' && Boolean(includeKk));
        const wantSzvb =
          recipientMode === 'szvb' ||
          recipientMode === 'kk_and_szvb' ||
          Boolean(includeSzvb) ||
          cleanSelectedSzvb.size > 0;

        if (wantKk) pushTargets(adminMembers, 'kk');
        if (wantSzvb) pushTargets(szvbMembers, 'szvb');
      }
    } else if (effectiveRole === 'szvb') {
      if (cleanReplyEmail) {
        const matched = activeMembers.filter((m) => normalizeEmail(m.email) === cleanReplyEmail);
        matched.forEach((m) => {
          const pType = replyToProfileType || (m.role === 'admin' ? 'kk' : m.role === 'auditor' ? 'auditor' : m.role === 'szvb' ? 'szvb' : 'owner');
          pushTargets([m], pType, replyToFlatNum || null);
        });
      } else if (recipientMode === 'auditor') {
        pushTargets(auditorMembers, 'auditor');
      } else if (recipientMode === 'kk_and_auditor') {
        pushTargets(adminMembers, 'kk');
        pushTargets(auditorMembers, 'auditor');
      } else {
        pushTargets(adminMembers, 'kk');
      }
    } else if (effectiveRole === 'auditor') {
      if (cleanReplyEmail) {
        const matched = activeMembers.filter((m) => normalizeEmail(m.email) === cleanReplyEmail);
        matched.forEach((m) => {
          const pType = replyToProfileType || (m.role === 'admin' ? 'kk' : m.role === 'szvb' ? 'szvb' : 'owner');
          pushTargets([m], pType, replyToFlatNum || null);
        });
      } else if (recipientMode === 'szvb') {
        pushTargets(szvbMembers, 'szvb');
      } else if (recipientMode === 'kk_and_szvb') {
        pushTargets(adminMembers, 'kk');
        pushTargets(szvbMembers, 'szvb');
      } else {
        pushTargets(adminMembers, 'kk');
      }
    } else {
      // Admin / SuperAdmin
      if (cleanReplyEmail) {
        const matched = activeMembers.filter((m) => normalizeEmail(m.email) === cleanReplyEmail);
        matched.forEach((m) => {
          const pType = replyToProfileType || (m.role === 'szvb' ? 'szvb' : m.role === 'auditor' ? 'auditor' : m.role === 'admin' ? 'kk' : 'owner');
          pushTargets([m], pType, replyToFlatNum || null);
        });
      } else if (recipientMode === 'szvb') {
        pushTargets(szvbMembers, 'szvb');
      } else if (recipientMode === 'auditor') {
        pushTargets(auditorMembers, 'auditor');
      } else {
        pushTargets(adminMembers, 'kk');
      }
    }

    // Deduplicate recipients by UID + targetProfileType (so multi-profile accounts still receive cross-profile mail cleanly)
    const recipientByKey = new Map();
    for (const entry of targetEntries) {
      const m = entry.member;
      const isSameUidAndSameRole =
        m.uid === callerUid &&
        ((entry.profileType === 'kk' && (effectiveRole === 'admin' || effectiveRole === 'superadmin')) ||
          entry.profileType === effectiveRole);
      if (!isSameUidAndSameRole) {
        recipientByKey.set(`${m.uid}::${entry.profileType}`, entry);
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
      owner: { hu: senderFlatNum ? `${senderFlatNum}. lakás tulajdonosa` : 'Tulajdonos', en: senderFlatNum ? `Flat #${senderFlatNum} Owner` : 'Owner' },
    };
    const lbl = roleLabels[effectiveRole] || roleLabels.owner;
    const senderProfileType =
      effectiveRole === 'admin' || effectiveRole === 'superadmin'
        ? 'kk'
        : effectiveRole === 'szvb'
          ? 'szvb'
          : effectiveRole === 'auditor'
            ? 'auditor'
            : 'owner';

    const batch = db.batch();
    let deliveredCount = 0;

    if (sendInApp) {
      for (const { member: recMember, profileType, flatNum: recFlatNum } of recipientByKey.values()) {
        const notifId = makeId('mail');
        batch.set(db.doc(`users/${recMember.uid}/notifications/${notifId}`), {
          id: notifId,
          threadId: resolvedThreadId,
          type: 'direct_message',
          severity: 'info',
          buildingId,
          buildingName: bName,
          ...(recFlatNum ? { flatNum: String(recFlatNum) } : {}),
          recipientEmail: normalizeEmail(recMember.email),
          targetProfile: {
            type: profileType,
            buildingId,
            ...(recFlatNum ? { flatNum: String(recFlatNum) } : {}),
          },
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
            threadId: resolvedThreadId,
            ...(replyToId ? { replyToId: String(replyToId) } : {}),
            senderRole: effectiveRole,
            senderRoleLabelHu: lbl.hu,
            senderRoleLabelEn: lbl.en,
            senderFlatNum: senderFlatNum ? String(senderFlatNum) : null,
            senderProfile: {
              type: senderProfileType,
              buildingId,
              ...(senderFlatNum ? { flatNum: String(senderFlatNum) } : {}),
            },
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
    const recipientNames = Array.from(recipientByKey.values())
      .map(({ member: m, profileType }) => {
        if (profileType === 'kk') return 'Közös Képviselet (KK)';
        if (profileType === 'szvb') return 'Számvizsgáló Bizottság (SZVB)';
        return m.name || m.email;
      })
      .filter(Boolean)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .slice(0, 6)
      .join(', ');

    batch.set(db.doc(`users/${callerUid}/notifications/${senderNotifId}`), {
      id: senderNotifId,
      threadId: resolvedThreadId,
      type: 'direct_message',
      severity: 'info',
      buildingId,
      buildingName: bName,
      ...(senderFlatNum ? { flatNum: String(senderFlatNum) } : {}),
      recipientEmail: callerEmail,
      targetProfile: {
        type: senderProfileType,
        buildingId,
        ...(senderFlatNum ? { flatNum: String(senderFlatNum) } : {}),
      },
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
        threadId: resolvedThreadId,
        ...(replyToId ? { replyToId: String(replyToId) } : {}),
        isSenderCopy: true,
        senderRole: effectiveRole,
        senderRoleLabelHu: lbl.hu,
        senderRoleLabelEn: lbl.en,
        senderFlatNum: senderFlatNum ? String(senderFlatNum) : null,
        senderProfile: {
          type: senderProfileType,
          buildingId,
          ...(senderFlatNum ? { flatNum: String(senderFlatNum) } : {}),
        },
        recipientSummaryHu: recipientNames || bName,
        recipientSummaryEn: recipientNames || bName,
        deliveryChannel,
      },
      createdAt: nowTs,
    });

    await batch.commit();

    return {
      success: true,
      threadId: resolvedThreadId,
      deliveredCount,
      senderNotifId,
    };
  }
);
