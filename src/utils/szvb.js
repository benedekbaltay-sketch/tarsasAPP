import { normalizeEmail } from './teamPermissions.js';

export const STATUTORY_SZVB_UNIT_THRESHOLD = 25;
export const STATUTORY_SZVB_MIN_TOTAL = 3;
export const STATUTORY_SZVB_MIN_MEMBERS = 2; // 1 chairperson + at least 2 members

/**
 * Normalize a Hungarian Land Registry Number (helyrajzi szám / hrsz.) for comparison.
 * Trims, collapses whitespace, and lowercases (e.g. " 12345 / 0 / A / 1 " -> "12345/0/a/1").
 */
export function normalizeHrsz(hrsz) {
  if (!hrsz || typeof hrsz !== 'string') return '';
  return hrsz.trim().replace(/\s+/g, '').toLowerCase();
}

/**
 * Count distinct condominium sub-units ("albetét") in a building.
 * Business rule: What sits on a separate Land Registry Number (helyrajzi szám / hrsz.)
 * counts as a separate albetét.
 *
 * - Units sharing the exact same normalized `hrsz` are counted ONCE (1 albetét).
 * - Units with distinct non-empty `hrsz` each count as 1 albetét.
 * - Annexes (garage/storage) on a flat that carry their own distinct `hrsz` also count as separate albetétek.
 * - Legacy units without an `hrsz` recorded yet fall back to counting as 1 albetét per unit entry.
 */
export function countBuildingAlbetets(building) {
  const flats = Array.isArray(building?.flats) ? building.flats : [];
  const distinctKeys = new Set();
  const distinctHrszSet = new Set();
  let unitsWithoutHrszCount = 0;

  flats.forEach((flat, idx) => {
    if (!flat) return;
    const norm = normalizeHrsz(flat.hrsz);
    if (norm) {
      distinctKeys.add(`hrsz:${norm}`);
      distinctHrszSet.add(norm);
    } else {
      unitsWithoutHrszCount += 1;
      const fallbackKey = flat.id || flat.unitId || flat.flatNum || `idx-${idx}`;
      distinctKeys.add(`unit:${String(fallbackKey).trim().toLowerCase()}`);
    }

    // Separate-HRSZ annexes (e.g. independently parcelled garage or storage)
    if (Array.isArray(flat.annexes)) {
      flat.annexes.forEach((annex) => {
        const annexNorm = normalizeHrsz(annex?.hrsz);
        if (annexNorm) {
          distinctKeys.add(`hrsz:${annexNorm}`);
          distinctHrszSet.add(annexNorm);
        }
      });
    }
  });

  const count = distinctKeys.size;
  return {
    count,
    distinctHrszCount: distinctHrszSet.size,
    unitsWithoutHrszCount,
    totalFlatRecords: flats.length,
    requiresSzvb: count > STATUTORY_SZVB_UNIT_THRESHOLD,
  };
}

/**
 * Collect all normalized emails belonging to an owner entry on a flat.
 */
function getOwnerEmails(owner, flatFallbackEmail = '') {
  const set = new Set();
  const add = (val) => {
    const n = normalizeEmail(val);
    if (n) set.add(n);
  };
  if (owner) {
    add(owner.email);
    if (Array.isArray(owner.emails)) {
      owner.emails.forEach(add);
    }
  }
  if (flatFallbackEmail) {
    add(flatFallbackEmail);
  }
  return Array.from(set);
}

/**
 * Build a stable deduplication key for an owner candidate in a building.
 */
export function buildOwnerCandidateKey(email, name, flatNum = '') {
  const normEmail = normalizeEmail(email);
  if (normEmail) return `email:${normEmail}`;
  const normName = String(name || '').trim().toLowerCase();
  const normFlat = String(flatNum || '').trim().toLowerCase();
  return `name:${normName}|flat:${normFlat}`;
}

/**
 * Extract all unique owner candidates from a building's flats so a KK admin
 * can appoint SZVB Chairperson and SZVB Members strictly from existing owners.
 */
export function getBuildingOwnerCandidates(building) {
  const flats = Array.isArray(building?.flats) ? building.flats : [];
  const byKey = new Map();

  const registerCandidate = ({ name, email, emails = [], flatNum }) => {
    const cleanName = String(name || '').trim();
    const normEmail = normalizeEmail(email || emails[0] || '');
    if (!cleanName && !normEmail) return;

    const key = buildOwnerCandidateKey(normEmail, cleanName, flatNum);
    const existing = byKey.get(key);
    const cleanFlatNum = String(flatNum || '').trim();

    if (existing) {
      if (cleanFlatNum && !existing.flatNums.includes(cleanFlatNum)) {
        existing.flatNums.push(cleanFlatNum);
      }
      if (!existing.name && cleanName) existing.name = cleanName;
      if (!existing.email && normEmail) {
        existing.email = normEmail;
        existing.hasEmail = true;
      }
      emails.forEach((em) => {
        const nem = normalizeEmail(em);
        if (nem && !existing.allEmails.includes(nem)) {
          existing.allEmails.push(nem);
        }
      });
      return;
    }

    const allEmails = Array.from(
      new Set([normEmail, ...emails.map(normalizeEmail)].filter(Boolean))
    );

    byKey.set(key, {
      key,
      name: cleanName || normEmail,
      email: normEmail,
      allEmails,
      hasEmail: Boolean(normEmail),
      flatNums: cleanFlatNum ? [cleanFlatNum] : [],
      primaryFlatNum: cleanFlatNum,
    });
  };

  flats.forEach((flat) => {
    if (!flat) return;
    const flatNum = String(flat.flatNum || '').trim();
    if (Array.isArray(flat.owners) && flat.owners.length > 0) {
      flat.owners.forEach((owner, idx) => {
        if (!owner) return;
        const emails = getOwnerEmails(owner, idx === 0 && flat.owners.length === 1 ? flat.email : '');
        registerCandidate({
          name: owner.name || (flat.owners.length === 1 ? flat.ownerName : ''),
          email: emails[0] || '',
          emails,
          flatNum,
        });
      });
    } else if (flat.ownerName || flat.email) {
      const normEmail = normalizeEmail(flat.email);
      registerCandidate({
        name: flat.ownerName || '',
        email: normEmail,
        emails: normEmail ? [normEmail] : [],
        flatNum,
      });
    }
  });

  return Array.from(byKey.values()).sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'hu', { sensitivity: 'base' })
  );
}

function sanitizeSzvbPerson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = normalizeEmail(raw.email);
  const name = String(raw.name || '').trim();
  const flatNum = String(raw.flatNum || raw.primaryFlatNum || '').trim();
  if (!name && !email) return null;
  return {
    key: raw.key || buildOwnerCandidateKey(email, name, flatNum),
    name: name || email,
    email,
    flatNum,
  };
}

/**
 * Resolve canonical SZVB structure for a building.
 * Supports modern `building.szvb` ({ chairperson, members }) and gracefully falls back
 * to legacy `flat.owners[].isBoardMember === true` flags if `building.szvb` is absent.
 */
export function normalizeBuildingSzvb(building) {
  const raw = building?.szvb;
  if (raw && typeof raw === 'object') {
    const chairperson = sanitizeSzvbPerson(raw.chairperson);
    const seen = new Set();
    if (chairperson) {
      seen.add(chairperson.key);
      if (chairperson.email) seen.add(`email:${chairperson.email}`);
    }

    const members = [];
    const rawMembers = Array.isArray(raw.members) ? raw.members : [];
    rawMembers.forEach((m) => {
      const clean = sanitizeSzvbPerson(m);
      if (!clean) return;
      const emailKey = clean.email ? `email:${clean.email}` : null;
      if (seen.has(clean.key) || (emailKey && seen.has(emailKey))) return;
      seen.add(clean.key);
      if (emailKey) seen.add(emailKey);
      members.push(clean);
    });

    return {
      chairperson,
      members,
      updatedAt: raw.updatedAt || null,
      updatedBy: raw.updatedBy || null,
    };
  }

  // Fallback for legacy data where only `owner.isBoardMember` was ticked
  const flats = Array.isArray(building?.flats) ? building.flats : [];
  let chairperson = null;
  const members = [];
  const seen = new Set();

  flats.forEach((flat) => {
    if (!flat || !Array.isArray(flat.owners)) return;
    flat.owners.forEach((owner, idx) => {
      if (!owner || !owner.isBoardMember) return;
      const emails = getOwnerEmails(owner, idx === 0 && flat.owners.length === 1 ? flat.email : '');
      const clean = sanitizeSzvbPerson({
        name: owner.name || flat.ownerName,
        email: emails[0] || '',
        flatNum: flat.flatNum,
      });
      if (!clean) return;
      const emailKey = clean.email ? `email:${clean.email}` : null;
      if (seen.has(clean.key) || (emailKey && seen.has(emailKey))) return;
      seen.add(clean.key);
      if (emailKey) seen.add(emailKey);

      if (owner.boardRole === 'chairperson' && !chairperson) {
        chairperson = clean;
      } else {
        members.push(clean);
      }
    });
  });

  return {
    chairperson,
    members,
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * Evaluate statutory SZVB compliance under Hungarian Condominium Act (Tht. 51. § (1)):
 * If a condominium has more than 25 distinct albetétek (separate HRSZ units),
 * it must have at least 3 SZVB members: 1 chairperson + at least 2 members.
 */
export function evaluateSzvbCompliance(building) {
  const albetetStats = countBuildingAlbetets(building);
  const szvb = normalizeBuildingSzvb(building);
  const hasChairperson = Boolean(szvb.chairperson);
  const membersCount = szvb.members.length;
  const totalSzvbCount = (hasChairperson ? 1 : 0) + membersCount;

  const requiresStatutorySzvb = albetetStats.count > STATUTORY_SZVB_UNIT_THRESHOLD;
  const isCompliant =
    !requiresStatutorySzvb ||
    (hasChairperson &&
      membersCount >= STATUTORY_SZVB_MIN_MEMBERS &&
      totalSzvbCount >= STATUTORY_SZVB_MIN_TOTAL);

  return {
    albetetCount: albetetStats.count,
    distinctHrszCount: albetetStats.distinctHrszCount,
    unitsWithoutHrszCount: albetetStats.unitsWithoutHrszCount,
    totalFlatRecords: albetetStats.totalFlatRecords,
    requiresStatutorySzvb,
    hasChairperson,
    membersCount,
    totalSzvbCount,
    isCompliant,
    showWarning: requiresStatutorySzvb && !isCompliant,
    szvb,
  };
}

/**
 * Resolve whether a user holds an SZVB role on a specific building.
 * Strictly checks exact authenticated email (never substring or name matching)
 * or verified Firestore `user.memberships` record.
 *
 * Returns { role: 'chairperson' | 'member', name, email, flatNum } or null.
 */
export function getUserBuildingSzvbInfo(user, building) {
  if (!user || !building || building.archived === true) return null;
  const userEmail = normalizeEmail(user.email);

  // 1. Check canonical building.szvb (and legacy isBoardMember fallback) by exact normalized email
  if (userEmail) {
    const szvb = normalizeBuildingSzvb(building);
    if (szvb.chairperson && normalizeEmail(szvb.chairperson.email) === userEmail) {
      return {
        role: 'chairperson',
        name: szvb.chairperson.name || user.name || userEmail,
        email: userEmail,
        flatNum: szvb.chairperson.flatNum || '',
      };
    }
    const matchedMember = szvb.members.find((m) => normalizeEmail(m.email) === userEmail);
    if (matchedMember) {
      return {
        role: 'member',
        name: matchedMember.name || user.name || userEmail,
        email: userEmail,
        flatNum: matchedMember.flatNum || '',
      };
    }

    // Also verify against allEmails on flat owners if primary email on SZVB entry differs from secondary email
    const candidates = getBuildingOwnerCandidates(building);
    const matchedCandidate = candidates.find((c) => c.allEmails.includes(userEmail));
    if (matchedCandidate) {
      if (szvb.chairperson && szvb.chairperson.key === matchedCandidate.key) {
        return {
          role: 'chairperson',
          name: szvb.chairperson.name || matchedCandidate.name,
          email: userEmail,
          flatNum: szvb.chairperson.flatNum || matchedCandidate.primaryFlatNum || '',
        };
      }
      const byKeyMember = szvb.members.find((m) => m.key === matchedCandidate.key);
      if (byKeyMember) {
        return {
          role: 'member',
          name: byKeyMember.name || matchedCandidate.name,
          email: userEmail,
          flatNum: byKeyMember.flatNum || matchedCandidate.primaryFlatNum || '',
        };
      }
    }
  }

  // 2. Check Firestore server-managed memberships (if present on user session)
  if (Array.isArray(user.memberships)) {
    const mem = user.memberships.find(
      (m) => m && m.buildingId === building.id && m.active !== false && m.role === 'szvb'
    );
    if (mem) {
      return {
        role: mem.szvbRole === 'chairperson' ? 'chairperson' : 'member',
        name: user.name || userEmail || '',
        email: userEmail,
        flatNum: mem.flatNum || user.flatNum || '',
      };
    }
  }

  return null;
}

export function isUserBuildingSzvb(user, building) {
  return Boolean(getUserBuildingSzvbInfo(user, building));
}

export function getUserBuildingSzvbRole(user, building) {
  const info = getUserBuildingSzvbInfo(user, building);
  return info ? info.role : null;
}

/**
 * List all buildings where the authenticated user holds an active SZVB role.
 */
export function getUserSzvbRolesAcrossBuildings(user, buildings = []) {
  if (!user || !Array.isArray(buildings)) return [];
  const results = [];
  buildings.forEach((b) => {
    if (!b || b.archived === true) return;
    const info = getUserBuildingSzvbInfo(user, b);
    if (info) {
      results.push({
        buildingId: b.id,
        buildingName: b.name || '',
        buildingAddress: b.address || '',
        szvbRole: info.role,
        name: info.name,
        email: info.email,
        flatNum: info.flatNum,
      });
    }
  });
  return results;
}

/**
 * Synchronize `building.szvb` assignments back onto `building.flats[].owners[]`
 * (`isBoardMember` & `boardRole`) so EditFlatMasterModal and CommunicationCenter
 * ("Csak SZVB tagok") stay 100% consistent with the Building Settings SZVB card.
 */
export function syncSzvbToBuildingFlats(flats = [], szvbData = null) {
  const normalized = normalizeBuildingSzvb({ szvb: szvbData || { chairperson: null, members: [] } });
  const chairEmail = normalizeEmail(normalized.chairperson?.email);
  const chairKey = normalized.chairperson?.key || '';
  const memberEmails = new Set(normalized.members.map((m) => normalizeEmail(m.email)).filter(Boolean));
  const memberKeys = new Set(normalized.members.map((m) => m.key).filter(Boolean));

  return (flats || []).map((flat) => {
    if (!flat || !Array.isArray(flat.owners) || flat.owners.length === 0) return flat;
    let changed = false;
    const nextOwners = flat.owners.map((owner, idx) => {
      if (!owner) return owner;
      const emails = getOwnerEmails(owner, idx === 0 && flat.owners.length === 1 ? flat.email : '');
      const ownerKey = buildOwnerCandidateKey(emails[0] || '', owner.name || flat.ownerName, flat.flatNum);

      let nextIsBoard = false;
      let nextBoardRole = null;

      if (
        (chairEmail && emails.includes(chairEmail)) ||
        (chairKey && ownerKey === chairKey)
      ) {
        nextIsBoard = true;
        nextBoardRole = 'chairperson';
      } else if (
        emails.some((em) => memberEmails.has(em)) ||
        memberKeys.has(ownerKey)
      ) {
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

    return changed ? { ...flat, owners: nextOwners } : flat;
  });
}
