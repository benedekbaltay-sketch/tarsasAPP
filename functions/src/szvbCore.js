/**
 * Pure, Deterministic Server-Side SZVB RBAC & Notification Planner
 *
 * Shared by the `manageSzvbMembers` Cloud Function and automated unit tests
 * (zero Firebase Admin runtime imports for fast, isolated verification).
 */

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function buildOwnerKey(email, name, flatNum = '') {
  const normEmail = normalizeEmail(email);
  if (normEmail) return `email:${normEmail}`;
  const normName = String(name || '').trim().toLowerCase();
  const normFlat = String(flatNum || '').trim().toLowerCase();
  return `name:${normName}|flat:${normFlat}`;
}

export function sanitizeSzvbPerson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = normalizeEmail(raw.email);
  const name = String(raw.name || '').trim().slice(0, 120);
  const flatNum = String(raw.flatNum || raw.unitCode || '').trim().slice(0, 32);
  if (!name && !email) return null;
  return {
    key: String(raw.key || buildOwnerKey(email, name, flatNum)).slice(0, 180),
    name: name || email,
    email,
    flatNum,
  };
}

/**
 * Sanitize and deduplicate an SZVB payload ({ chairperson, members }).
 * Guarantees the chairperson never also appears inside members[], and no duplicate emails/keys exist.
 */
export function sanitizeSzvbPayload(raw = {}) {
  const chairperson = sanitizeSzvbPerson(raw?.chairperson);
  const seen = new Set();
  if (chairperson) {
    seen.add(chairperson.key);
    if (chairperson.email) seen.add(`email:${chairperson.email}`);
  }

  const members = [];
  const rawMembers = Array.isArray(raw?.members) ? raw.members : [];
  for (const item of rawMembers) {
    const clean = sanitizeSzvbPerson(item);
    if (!clean) continue;
    const emailKey = clean.email ? `email:${clean.email}` : null;
    if (seen.has(clean.key) || (emailKey && seen.has(emailKey))) continue;
    seen.add(clean.key);
    if (emailKey) seen.add(emailKey);
    members.push(clean);
  }

  return { chairperson, members };
}

function collectOwnerEmails(owner) {
  const out = new Set();
  if (!owner || typeof owner !== 'object') return [];
  const add = (v) => {
    const n = normalizeEmail(v);
    if (n) out.add(n);
  };
  add(owner.email);
  if (Array.isArray(owner.emails)) owner.emails.forEach(add);
  return Array.from(out);
}

/**
 * Build rich bilingual notification payload for a server-side `users/{uid}/notifications` doc.
 */
function buildServerSzvbNotification({
  action, // 'granted' | 'modified' | 'revoked'
  prevRole,
  nextRole,
  buildingId,
  buildingName,
  flatNum = null,
  actor,
  recipientEmail,
}) {
  const bName = buildingName || buildingId || 'Társasház';
  const roleHu = (r) => (r === 'chairperson' ? 'SZVB Elnök' : 'SZVB Tag');
  const roleEn = (r) => (r === 'chairperson' ? 'SZVB Chairperson' : 'SZVB Member');
  const ownerTargetProfile = {
    type: 'owner',
    buildingId: buildingId || null,
    flatNum: flatNum || null,
  };

  if (action === 'granted') {
    const rHu = roleHu(nextRole);
    const rEn = roleEn(nextRole);
    return {
      type: 'szvb_updated',
      severity: 'info',
      recipientEmail,
      buildingId,
      buildingName: bName,
      flatNum: flatNum || null,
      targetProfile: ownerTargetProfile,
      actorUid: actor?.uid || null,
      actorEmail: actor?.email || '',
      actorName: actor?.name || actor?.email || '',
      titleHu: `${rHu} jogosultságot kaptál — ${bName}`,
      titleEn: `${rEn} access granted — ${bName}`,
      messageHu: [
        `A(z) ${bName} társasházban ${rHu} jogosultságot kaptál (szigorúan csak olvasási ellenőrzési jog).`,
        `🔄 Hogyan tudsz átlépni az SZVB nézetbe és vissza?\n1. A felső fejléc jobb oldalán kattints a „Lakás / SZVB” (Profilváltás) gombra, vagy nyisd meg a bal felső ☰ menüt és válaszd az „SZVB Ellenőrző nézet” gombot.\n2. Bármikor ugyanígy visszaválthatsz a saját lakásod tulajdonosi nézetére („Váltás saját lakásomra”).`,
        `👁️ Mikhez férsz hozzá SZVB-tagként?\n• Ügyintézés ellenőrzése (Dokumentumok): iratok, szerződések, bankkivonatok megtekintése és letöltése.\n• Havi pénzforgalom ellenőrzése (Főmenü & Pénzügyek): a ház összes bevétele, kiadása, bizonylatai, banki egyenlegei (Pénzügyek → Bank) és a lakók hátraléklistája.\n• Lakások adatai, hitelek, közgyűlési egyenlegkimutatások és ellenőri vélemények megtekintése.`,
        `🔒 Fontos korlátozás (Csak olvasás):\nSZVB-tagként egyetlen adatot sem tudsz módosítani vagy törölni, és nem küldhetsz ki e-maileket vagy fizetési felszólításokat.`,
      ].join('\n\n'),
      messageEn: [
        `You have been granted ${rEn} access (strictly read-only audit oversight) for ${bName}.`,
        `🔄 How to switch between your apartment and SZVB view:\n1. Click the "Flat / SZVB" (Switch Profile) button in the top-right header, or open the top-left ☰ menu and select "SZVB Audit View".\n2. You can switch back to your personal apartment view anytime the same way ("Switch to My Apartment").`,
        `👁️ What you can inspect as an SZVB member:\n• Administration oversight (Documents): view and download documents, contracts, and bank statements.\n• Monthly financial oversight (Dashboard & Finances): building income, expenses, receipts, bank balances (Finances → Bank), and the full resident arrears list.\n• Flats master data, loans, general assembly balance statements, and audit opinions.`,
        `🔒 Read-Only Restriction:\nAs an SZVB member, you cannot edit or delete any data, and you cannot send emails or payment reminders.`,
      ].join('\n\n'),
      changes: [
        {
          type: 'granted',
          labelHu: `${rHu} szerepkör (${bName}) — Csak olvasás`,
          labelEn: `${rEn} role (${bName}) — Read-Only`,
        },
        {
          type: 'granted',
          labelHu: 'Ügyintézés ellenőrzése: iratok, szerződések, bankkivonatok megtekintése és letöltése',
          labelEn: 'Administration oversight: view/download documents, contracts, and bank statements',
        },
        {
          type: 'granted',
          labelHu: 'Havi pénzforgalom ellenőrzése: bevételek, kiadások, banki egyenlegek és hátraléklista',
          labelEn: 'Financial oversight: income, expenses, bank balances, and resident arrears list',
        },
      ],
      meta: { szvbAction: 'granted', prevRole: null, nextRole, flatNum: flatNum || null },
      read: false,
      archived: false,
      deleted: false,
      dismissed: false,
    };
  }

  if (action === 'modified') {
    const prevHu = roleHu(prevRole);
    const nextHu = roleHu(nextRole);
    const prevEn = roleEn(prevRole);
    const nextEn = roleEn(nextRole);
    return {
      type: 'szvb_updated',
      severity: 'info',
      recipientEmail,
      buildingId,
      buildingName: bName,
      flatNum: flatNum || null,
      targetProfile: ownerTargetProfile,
      actorUid: actor?.uid || null,
      actorEmail: actor?.email || '',
      actorName: actor?.name || actor?.email || '',
      titleHu: `SZVB szerepköröd módosult (${nextHu}) — ${bName}`,
      titleEn: `SZVB role updated (${nextEn}) — ${bName}`,
      messageHu: [
        `A(z) ${bName} társasházban az SZVB szerepköröd módosult: ${prevHu} → ${nextHu}.`,
        `🔄 Használat:\nA felső fejléc „Lakás / SZVB” gombjával vagy a bal felső ☰ menüből továbbra is bármikor átléphetsz a csak olvasási SZVB ellenőrző nézetbe (pénzforgalom, banki egyenlegek, hátraléklista, hitelek és iratok megtekintése/letöltése).`,
      ].join('\n\n'),
      messageEn: [
        `Your SZVB role for ${bName} has been updated: ${prevEn} → ${nextEn}.`,
        `🔄 Usage:\nUse the "Flat / SZVB" switcher in the header or the top-left ☰ menu anytime to enter the read-only SZVB audit view (finances, bank balances, arrears list, loans, and documents).`,
      ].join('\n\n'),
      changes: [
        {
          type: 'modified',
          labelHu: `SZVB szerepkör: ${prevHu} → ${nextHu}`,
          labelEn: `SZVB role: ${prevEn} → ${nextEn}`,
        },
      ],
      meta: { szvbAction: 'modified', prevRole, nextRole, flatNum: flatNum || null },
      read: false,
      archived: false,
      deleted: false,
      dismissed: false,
    };
  }

  // Revoked
  const prevHu = roleHu(prevRole);
  const prevEn = roleEn(prevRole);
  return {
    type: 'szvb_updated',
    severity: 'info',
    recipientEmail,
    buildingId,
    buildingName: bName,
    flatNum: flatNum || null,
    targetProfile: ownerTargetProfile,
    actorUid: actor?.uid || null,
    actorEmail: actor?.email || '',
    actorName: actor?.name || actor?.email || '',
    titleHu: `${prevHu} jogosultságod visszavonva — ${bName}`,
    titleEn: `${prevEn} access revoked — ${bName}`,
    messageHu: [
      `A(z) ${bName} társasházban a(z) ${prevHu} jogosultságod visszavonásra került.`,
      `Az SZVB ellenőrző nézet (teljes ház pénzforgalma, hátraléklista, belső iratok) már nem érhető el a fiókodból. A saját lakásod tulajdonosi nézete és adatai változatlanul elérhetők.`,
    ].join('\n\n'),
    messageEn: [
      `Your ${prevEn} audit access for ${bName} has been revoked.`,
      `The SZVB audit view (full building cashflow, arrears list, and internal documents) is no longer accessible from your account. Your personal apartment owner view remains unchanged.`,
    ].join('\n\n'),
    changes: [
      {
        type: 'revoked',
        labelHu: `${prevHu} szerepkör visszavonva (${bName})`,
        labelEn: `${prevEn} role revoked (${bName})`,
      },
    ],
    meta: { szvbAction: 'revoked', prevRole, nextRole: null, flatNum: flatNum || null },
    read: false,
    archived: false,
    deleted: false,
    dismissed: false,
  };
}

/**
 * Compute the complete atomic mutation plan for `manageSzvbMembers`.
 *
 * Security invariants enforced:
 * 1. Existing `'admin'` members are NEVER downgraded to `'szvb'` or `'owner'`.
 * 2. Promoted SZVB members keep their existing `unitIds` + any unitIds matched on `units`.
 * 3. Revoked SZVB members are atomically downgraded to `'owner'` (active if they own >= 1 unit,
 *    inactive otherwise), immediately restoring strict Firestore Security Rules GDPR isolation.
 * 4. Every unit's `owners[].isBoardMember` & `boardRole` flags stay 100% synchronized.
 * 5. Rich HU/EN notifications are planned for every granted, modified, or revoked user with a UID.
 */
export function computeSzvbMembershipPlan({
  buildingId,
  buildingName = '',
  prevSzvb = null,
  nextSzvbRaw = null,
  existingMembersByUid = new Map(), // Map<uid, memberDocData>
  resolvedUidByEmail = new Map(),   // Map<normalizedEmail, uid>
  units = [],                       // Array<{ id, unitCode, ownerUids, owners }>
  actor = null,
}) {
  const prevClean = sanitizeSzvbPayload(prevSzvb || {});
  const nextClean = sanitizeSzvbPayload(nextSzvbRaw || {});

  // Build maps of email -> role ('chairperson' | 'member') for previous and next SZVB
  const prevRoleByEmail = new Map();
  if (prevClean.chairperson?.email) prevRoleByEmail.set(prevClean.chairperson.email, 'chairperson');
  prevClean.members.forEach((m) => {
    if (m.email) prevRoleByEmail.set(m.email, 'member');
  });

  const nextRoleByEmail = new Map();
  const nextPersonByEmail = new Map();
  if (nextClean.chairperson?.email) {
    nextRoleByEmail.set(nextClean.chairperson.email, 'chairperson');
    nextPersonByEmail.set(nextClean.chairperson.email, nextClean.chairperson);
  }
  nextClean.members.forEach((m) => {
    if (m.email) {
      nextRoleByEmail.set(m.email, 'member');
      nextPersonByEmail.set(m.email, m);
    }
  });

  // Helper: find all unit IDs owned by a uid or email in this building
  const findOwnedUnitIds = (uid, email) => {
    const owned = new Set();
    const normEmail = normalizeEmail(email);
    for (const u of units || []) {
      if (!u || !u.id) continue;
      if (uid && Array.isArray(u.ownerUids) && u.ownerUids.includes(uid)) {
        owned.add(u.id);
        continue;
      }
      if (normEmail && Array.isArray(u.owners)) {
        const hasEmail = u.owners.some((o) => collectOwnerEmails(o).includes(normEmail));
        if (hasEmail) owned.add(u.id);
      }
    }
    return Array.from(owned);
  };

  // Helper: find canonical flat number (unitCode) owned by a uid or email so Owner-profile notifications route reliably
  const findOwnedFlatNum = (uid, email, fallbackFlatNum = '') => {
    const normFallback = String(fallbackFlatNum || '').trim();
    if (normFallback) return normFallback;
    const normEmail = normalizeEmail(email);
    for (const u of units || []) {
      if (!u) continue;
      const uidMatch = Boolean(uid && Array.isArray(u.ownerUids) && u.ownerUids.includes(uid));
      const emailMatch = Boolean(
        normEmail &&
        Array.isArray(u.owners) &&
        u.owners.some((o) => collectOwnerEmails(o).includes(normEmail))
      );
      if (uidMatch || emailMatch) {
        const code = String(u.unitCode || u.flatNum || '').trim();
        if (code) return code;
      }
    }
    return null;
  };

  // Track which UIDs should hold SZVB now, and which previously held SZVB
  const nextSzvbRoleByUid = new Map(); // uid -> { szvbRole, email, person }
  const unresolvedEmails = [];

  for (const [email, szvbRole] of nextRoleByEmail.entries()) {
    const uid = resolvedUidByEmail.get(email);
    if (!uid) {
      unresolvedEmails.push(email);
      continue;
    }
    nextSzvbRoleByUid.set(uid, {
      szvbRole,
      email,
      person: nextPersonByEmail.get(email),
    });
  }

  // Gather ALL previously-SZVB UIDs: both from existing `members/{uid}` docs with role === 'szvb'
  // AND from `prevSzvb` emails resolved to UIDs.
  const prevSzvbRoleByUid = new Map(); // uid -> { szvbRole, email }
  for (const [uid, mem] of existingMembersByUid.entries()) {
    if (!mem) continue;
    if (mem.role === 'szvb' && mem.active !== false) {
      const em = normalizeEmail(mem.email);
      prevSzvbRoleByUid.set(uid, {
        szvbRole: mem.szvbRole || prevRoleByEmail.get(em) || 'member',
        email: em,
      });
    }
  }
  for (const [email, szvbRole] of prevRoleByEmail.entries()) {
    const uid = resolvedUidByEmail.get(email);
    if (uid && !prevSzvbRoleByUid.has(uid)) {
      prevSzvbRoleByUid.set(uid, { szvbRole, email });
    }
  }

  const memberWrites = [];       // Array<{ uid, memberDoc, userMembershipPatch }>
  const notificationsToSend = []; // Array<{ uid, notification }>
  const promotedUids = [];
  const modifiedUids = [];
  const revokedUids = [];

  // 1. Grant or update SZVB members
  for (const [uid, { szvbRole, email, person }] of nextSzvbRoleByUid.entries()) {
    const existing = existingMembersByUid.get(uid) || null;
    const prevSzvbInfo = prevSzvbRoleByUid.get(uid) || null;
    const mergedUnitIds = Array.from(
      new Set([
        ...(Array.isArray(existing?.unitIds) ? existing.unitIds : []),
        ...findOwnedUnitIds(uid, email),
      ])
    );

    const isExistingAdmin = existing?.active !== false && existing?.role === 'admin';
    const nextRole = isExistingAdmin ? 'admin' : 'szvb';
    const resolvedFlatNum = findOwnedFlatNum(uid, email, person?.flatNum || existing?.flatNum || '');

    const memberDoc = {
      uid,
      email: email || normalizeEmail(existing?.email),
      role: nextRole,
      szvbRole,
      flatNum: resolvedFlatNum || '',
      unitIds: mergedUnitIds,
      active: true,
      accessFromDate: existing?.accessFromDate || null,
      grantedBy: actor?.uid || existing?.grantedBy || null,
    };

    const userMembershipPatch = {
      buildingName: buildingName || buildingId,
      role: nextRole,
      szvbRole,
      unitIds: mergedUnitIds,
      active: true,
    };

    const needsMemberWrite =
      !existing ||
      existing.role !== memberDoc.role ||
      (existing.szvbRole || null) !== memberDoc.szvbRole ||
      existing.active !== true ||
      JSON.stringify(existing.unitIds || []) !== JSON.stringify(mergedUnitIds);

    if (needsMemberWrite) {
      memberWrites.push({ uid, memberDoc, userMembershipPatch });
    }

    if (!prevSzvbInfo) {
      promotedUids.push(uid);
      notificationsToSend.push({
        uid,
        notification: buildServerSzvbNotification({
          action: 'granted',
          prevRole: null,
          nextRole: szvbRole,
          buildingId,
          buildingName,
          flatNum: resolvedFlatNum,
          actor,
          recipientEmail: email,
        }),
      });
    } else if (prevSzvbInfo.szvbRole !== szvbRole) {
      modifiedUids.push(uid);
      notificationsToSend.push({
        uid,
        notification: buildServerSzvbNotification({
          action: 'modified',
          prevRole: prevSzvbInfo.szvbRole,
          nextRole: szvbRole,
          buildingId,
          buildingName,
          flatNum: resolvedFlatNum,
          actor,
          recipientEmail: email,
        }),
      });
    }
  }

  // 2. Revoke removed SZVB members (atomic downgrade to 'owner' or inactive; NEVER downgrade 'admin')
  for (const [uid, { szvbRole: prevRole, email }] of prevSzvbRoleByUid.entries()) {
    if (nextSzvbRoleByUid.has(uid)) continue;

    const existing = existingMembersByUid.get(uid) || null;
    const isExistingAdmin = existing?.active !== false && existing?.role === 'admin';
    const resolvedEmail = email || normalizeEmail(existing?.email);
    const resolvedFlatNum = findOwnedFlatNum(uid, resolvedEmail, existing?.flatNum || '');
    const mergedUnitIds = Array.from(
      new Set([
        ...(Array.isArray(existing?.unitIds) ? existing.unitIds : []),
        ...findOwnedUnitIds(uid, resolvedEmail),
      ])
    );

    if (!isExistingAdmin) {
      const stillOwnsUnit = mergedUnitIds.length > 0;
      const memberDoc = {
        uid,
        email: resolvedEmail,
        role: 'owner',
        szvbRole: null,
        flatNum: resolvedFlatNum || existing?.flatNum || '',
        unitIds: mergedUnitIds,
        active: stillOwnsUnit,
        accessFromDate: existing?.accessFromDate || null,
        grantedBy: actor?.uid || existing?.grantedBy || null,
      };
      const userMembershipPatch = {
        buildingName: buildingName || buildingId,
        role: 'owner',
        szvbRole: null,
        unitIds: mergedUnitIds,
        active: stillOwnsUnit,
      };
      memberWrites.push({ uid, memberDoc, userMembershipPatch });
    } else if (existing?.szvbRole) {
      // Admin stays admin, just clear szvbRole metadata
      const memberDoc = {
        ...existing,
        role: 'admin',
        szvbRole: null,
      };
      memberWrites.push({
        uid,
        memberDoc,
        userMembershipPatch: {
          buildingName: buildingName || buildingId,
          role: 'admin',
          szvbRole: null,
          unitIds: mergedUnitIds,
          active: true,
        },
      });
    }

    revokedUids.push(uid);
    notificationsToSend.push({
      uid,
      notification: buildServerSzvbNotification({
        action: 'revoked',
        prevRole,
        nextRole: null,
        buildingId,
        buildingName,
        flatNum: resolvedFlatNum,
        actor,
        recipientEmail: resolvedEmail,
      }),
    });
  }

  // 3. Synchronize `units/{unitId}.owners[].isBoardMember` & `boardRole`
  const chairEmail = nextClean.chairperson?.email || '';
  const chairKey = nextClean.chairperson?.key || '';
  const memberEmails = new Set(nextClean.members.map((m) => m.email).filter(Boolean));
  const memberKeys = new Set(nextClean.members.map((m) => m.key).filter(Boolean));

  const unitUpdates = []; // Array<{ unitId, owners }>
  for (const unit of units || []) {
    if (!unit || !unit.id || !Array.isArray(unit.owners) || unit.owners.length === 0) continue;
    let changed = false;
    const nextOwners = unit.owners.map((owner) => {
      if (!owner || typeof owner !== 'object') return owner;
      const emails = collectOwnerEmails(owner);
      const ownerKey = buildOwnerKey(emails[0] || '', owner.name, unit.unitCode || unit.id);

      let nextIsBoard = false;
      let nextBoardRole = null;
      if ((chairEmail && emails.includes(chairEmail)) || (chairKey && ownerKey === chairKey)) {
        nextIsBoard = true;
        nextBoardRole = 'chairperson';
      } else if (emails.some((em) => memberEmails.has(em)) || memberKeys.has(ownerKey)) {
        nextIsBoard = true;
        nextBoardRole = 'member';
      }

      if (Boolean(owner.isBoardMember) !== nextIsBoard || (owner.boardRole || null) !== nextBoardRole) {
        changed = true;
        return {
          ...owner,
          isBoardMember: nextIsBoard,
          boardRole: nextBoardRole,
        };
      }
      return owner;
    });

    if (changed) {
      unitUpdates.push({ unitId: unit.id, owners: nextOwners });
    }
  }

  // 4. Immutable audit log summary
  const summaryParts = [];
  if (promotedUids.length > 0) summaryParts.push(`granted: ${promotedUids.length}`);
  if (modifiedUids.length > 0) summaryParts.push(`modified: ${modifiedUids.length}`);
  if (revokedUids.length > 0) summaryParts.push(`revoked: ${revokedUids.length}`);
  const summary = `Updated SZVB committee for "${buildingName || buildingId}" (${summaryParts.join(', ') || 'metadata sync'})`;

  return {
    szvbDoc: {
      chairperson: nextClean.chairperson || null,
      members: nextClean.members,
      updatedBy: actor?.email || actor?.uid || 'admin',
    },
    prevSzvb: prevClean,
    memberWrites,
    unitUpdates,
    notificationsToSend,
    promotedUids,
    modifiedUids,
    revokedUids,
    unresolvedEmails,
    auditSummary: summary,
  };
}
