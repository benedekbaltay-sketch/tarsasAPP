/**
 * Economic Auditor / Financial Audit Assistant (Gazdasági ellenőrzést segítő személy — Tht. 51/A. §)
 * Pure ES module (zero React/Firebase runtime dependencies) so it can be shared
 * across UI components, Context actions, Cloud Functions, and Node unit tests.
 */

import { normalizeEmail, buildNotification, findOrganizationForBuilding } from './teamPermissions.js';
import { countBuildingAlbetets } from './szvb.js';

export const ECONOMIC_AUDITOR_UNIT_THRESHOLD = 50;
export const ECONOMIC_AUDITOR_TURNOVER_THRESHOLD_HUF = 10_000_000;

export const AUDIT_OPINION_VERDICTS = Object.freeze([
  'approved',
  'approved_with_notes',
  'rejected',
]);

export const AUDIT_OBSERVATION_SEVERITIES = Object.freeze([
  'info',
  'warning',
  'critical',
]);

export const AUDIT_OBSERVATION_CATEGORIES = Object.freeze([
  'bookkeeping',
  'invoice',
  'bank',
  'contract',
  'budget',
  'other',
]);

function getTodayIsoDate(nowDateStr = null) {
  if (nowDateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(nowDateStr).trim())) {
    return String(nowDateStr).trim();
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sanitize & normalize a building.economicAuditor payload before persisting.
 */
export function sanitizeEconomicAuditor(raw, actorEmail = '') {
  const src = raw && typeof raw === 'object' ? raw : {};
  const email = normalizeEmail(src.email);
  const name = String(src.name || '').trim();
  const type = src.type === 'internal' ? 'internal' : 'external';
  const enabled = Boolean(src.enabled && email);
  const cleanDate = (v) => {
    const s = String(v || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  };

  return {
    enabled,
    type,
    name: enabled ? (name || email) : '',
    email: enabled ? email : '',
    phone: enabled ? String(src.phone || '').trim() : '',
    companyName: enabled ? String(src.companyName || '').trim() : '',
    registrationNumber: enabled ? String(src.registrationNumber || '').trim() : '',
    flatNum: enabled && type === 'internal' ? String(src.flatNum || '').trim() : '',
    validFrom: enabled ? cleanDate(src.validFrom) : '',
    validTo: enabled ? cleanDate(src.validTo) : '',
    exemptQualifiedSzvbMember: Boolean(src.exemptQualifiedSzvbMember),
    updatedAt: src.updatedAt || new Date().toISOString(),
    updatedBy: normalizeEmail(actorEmail) || normalizeEmail(src.updatedBy) || '',
  };
}

/**
 * Check whether an economicAuditor record is currently active (enabled, has email, and within optional validity dates).
 */
export function isEconomicAuditorActive(auditor, nowDateStr = null) {
  if (!auditor || typeof auditor !== 'object') return false;
  if (!auditor.enabled) return false;
  const email = normalizeEmail(auditor.email);
  if (!email) return false;

  const today = getTodayIsoDate(nowDateStr);
  if (auditor.validFrom && /^\d{4}-\d{2}-\d{2}$/.test(auditor.validFrom) && today < auditor.validFrom) {
    return false;
  }
  if (auditor.validTo && /^\d{4}-\d{2}-\d{2}$/.test(auditor.validTo) && today > auditor.validTo) {
    return false;
  }
  return true;
}

/**
 * Strict, fail-closed check whether `user` is the active Economic Auditor of `building`.
 */
export function isUserBuildingEconomicAuditor(user, building, nowDateStr = null) {
  if (!user || !building || building.archived === true) return false;
  const userEmail = normalizeEmail(user.email || user.username || '');
  if (!userEmail) return false;
  const auditor = building.economicAuditor;
  if (!isEconomicAuditorActive(auditor, nowDateStr)) return false;
  return normalizeEmail(auditor.email) === userEmail;
}

/**
 * List all active Economic Auditor assignments for `user` across all non-archived buildings.
 * Works identically for internal owners and external independent auditors overseeing 1..N buildings.
 */
export function getUserEconomicAuditorRolesAcrossBuildings(user, buildings = [], nowDateStr = null) {
  if (!user || !Array.isArray(buildings)) return [];
  const results = [];
  for (const b of buildings) {
    if (!b || b.archived === true) continue;
    if (!isUserBuildingEconomicAuditor(user, b, nowDateStr)) continue;
    const auditor = b.economicAuditor;
    results.push({
      buildingId: b.id,
      buildingName: b.name || '',
      type: auditor.type === 'internal' ? 'internal' : 'external',
      name: auditor.name || user.name || normalizeEmail(user.email),
      email: normalizeEmail(auditor.email),
      flatNum: auditor.type === 'internal' ? String(auditor.flatNum || '') : '',
      companyName: auditor.companyName || '',
      registrationNumber: auditor.registrationNumber || '',
      validFrom: auditor.validFrom || '',
      validTo: auditor.validTo || '',
    });
  }
  return results;
}

/**
 * Calculate annual financial turnover (inflows + outflows) for Tht. 51/A. § 10M HUF threshold evaluation.
 * Evaluates the last completed calendar year (year - 1) and the current calendar year, returning the higher
 * turnover so newly onboarded buildings with current-year ledger entries are also evaluated accurately.
 */
export function calculateBuildingAnnualTurnover(building, nowDateStr = null) {
  if (!building || typeof building !== 'object') {
    return { annualTurnoverHuf: 0, turnoverYear: new Date().getFullYear() - 1, prevYearTurnover: 0, curYearTurnover: 0 };
  }

  const today = getTodayIsoDate(nowDateStr);
  const curYear = parseInt(today.slice(0, 4), 10) || new Date().getFullYear();
  const prevYear = curYear - 1;

  const extractYear = (d) => {
    if (!d) return null;
    const m = String(d).trim().match(/^(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  };

  const sumYear = (yr) => {
    let total = 0;
    for (const tx of building.transactions || []) {
      if (!tx || tx.type === 'Correction' || tx.includeInBalance === false) continue;
      if (tx.status && tx.status !== 'Verified') continue;
      if (extractYear(tx.date) !== yr) continue;
      const amt = Math.abs(Number(tx.amount) || 0);
      if (Number.isFinite(amt)) total += amt;
    }
    for (const exp of building.expenses || []) {
      if (!exp || exp.includeInBalance === false) continue;
      if (extractYear(exp.date) !== yr) continue;
      const amt = Math.abs(Number(exp.amount) || 0);
      if (Number.isFinite(amt)) total += amt;
    }
    return Math.round(total);
  };

  const prevYearTurnover = sumYear(prevYear);
  const curYearTurnover = sumYear(curYear);

  if (prevYearTurnover >= curYearTurnover && prevYearTurnover > 0) {
    return { annualTurnoverHuf: prevYearTurnover, turnoverYear: prevYear, prevYearTurnover, curYearTurnover };
  }
  if (curYearTurnover > 0) {
    return { annualTurnoverHuf: curYearTurnover, turnoverYear: curYear, prevYearTurnover, curYearTurnover };
  }
  return { annualTurnoverHuf: 0, turnoverYear: prevYear, prevYearTurnover: 0, curYearTurnover: 0 };
}

/**
 * Evaluate statutory Tht. 51/A. § compliance for a condominium building:
 * Required when:
 *   - Distinct parcelled units (albetétek) > 50, OR
 *   - Annual financial turnover > 10,000,000 HUF
 * Exempt when:
 *   - `building.economicAuditor.exemptQualifiedSzvbMember === true`
 *     (the SZVB already has a registered accountant / certified auditor member).
 */
export function evaluateEconomicAuditorCompliance(building, { nowDateStr = null } = {}) {
  const albetetStats = countBuildingAlbetets(building);
  const albetetCount = albetetStats.count;
  const turnover = calculateBuildingAnnualTurnover(building, nowDateStr);
  const annualTurnoverHuf = turnover.annualTurnoverHuf;

  const triggeredByUnits = albetetCount > ECONOMIC_AUDITOR_UNIT_THRESHOLD;
  const triggeredByTurnover = annualTurnoverHuf > ECONOMIC_AUDITOR_TURNOVER_THRESHOLD_HUF;
  const required = triggeredByUnits || triggeredByTurnover;

  const auditor = building?.economicAuditor || null;
  const hasActiveAuditor = isEconomicAuditorActive(auditor, nowDateStr);
  const isExemptByQualifiedSzvb = Boolean(auditor?.exemptQualifiedSzvbMember);

  const compliant = !required || hasActiveAuditor || isExemptByQualifiedSzvb;
  const showWarning = required && !hasActiveAuditor && !isExemptByQualifiedSzvb;

  const formattedTurnoverHu = `${annualTurnoverHuf.toLocaleString('hu-HU')} Ft`;
  const formattedTurnoverEn = `${annualTurnoverHuf.toLocaleString('en-US')} HUF`;

  let triggerReasonHu = '';
  let triggerReasonEn = '';
  if (triggeredByUnits && triggeredByTurnover) {
    triggerReasonHu = `a társasházban ${albetetCount} külön albetét van (50 felett), és a(z) ${turnover.turnoverYear}. évi pénzügyi forgalom (${formattedTurnoverHu}) meghaladja a 10 000 000 Ft-ot`;
    triggerReasonEn = `this condominium has ${albetetCount} distinct units (over 50) and its ${turnover.turnoverYear} financial turnover (${formattedTurnoverEn}) exceeds 10,000,000 HUF`;
  } else if (triggeredByUnits) {
    triggerReasonHu = `a társasházban jelenleg ${albetetCount} külön helyrajzi számú albetét szerepel (50 felett)`;
    triggerReasonEn = `this condominium currently has ${albetetCount} distinct parcelled units (over 50)`;
  } else if (triggeredByTurnover) {
    triggerReasonHu = `a társasház ${turnover.turnoverYear}. évi pénzügyi forgalma (${formattedTurnoverHu}) meghaladja a 10 000 000 Ft-ot`;
    triggerReasonEn = `this condominium's ${turnover.turnoverYear} financial turnover (${formattedTurnoverEn}) exceeds 10,000,000 HUF`;
  }

  return {
    required,
    triggeredByUnits,
    triggeredByTurnover,
    albetetCount,
    annualTurnoverHuf,
    turnoverYear: turnover.turnoverYear,
    hasActiveAuditor,
    isExemptByQualifiedSzvb,
    compliant,
    showWarning,
    triggerReasonHu,
    triggerReasonEn,
  };
}

/**
 * Build rich bilingual HU/EN notifications when an Economic Auditor is appointed, updated, or revoked.
 */
export function buildEconomicAuditorUpdateNotifications({
  building,
  prevAuditor = null,
  nextAuditor = null,
  actorUser = null,
}) {
  if (!building) return [];

  const buildingId = building.id || '';
  const buildingName = building.name || 'Társasház';
  const actorName = actorUser?.name || actorUser?.email || 'Közös Képviselet';

  const prevEmail = prevAuditor?.enabled ? normalizeEmail(prevAuditor.email) : '';
  const nextEmail = nextAuditor?.enabled ? normalizeEmail(nextAuditor.email) : '';

  const notifs = [];

  const makeTargetProfile = (aud) => {
    if (aud?.type === 'internal' && aud?.flatNum) {
      return { type: 'owner', buildingId, flatNum: String(aud.flatNum) };
    }
    return { type: 'auditor', buildingId, flatNum: null };
  };

  // 1. Revoked previous auditor (if removed or replaced by someone else)
  if (prevEmail && prevEmail !== nextEmail) {
    notifs.push(
      buildNotification({
        recipientEmail: prevEmail,
        buildingId,
        buildingName,
        type: 'auditor_updated',
        severity: 'warning',
        actorUser,
        flatNum: prevAuditor?.type === 'internal' ? prevAuditor.flatNum || null : null,
        targetProfile: makeTargetProfile(prevAuditor),
        titleHu: `Gazdasági ellenőri megbízás visszavonva — ${buildingName}`,
        titleEn: `Financial Auditor Assignment Revoked — ${buildingName}`,
        messageHu: `A(z) ${buildingName} társasházban a gazdasági ellenőrzést segítő személy (Tht. 51/A. §) jogosultságod visszavonásra került.`,
        messageEn: `Your Financial Auditor (Tht. § 51/A) access in ${buildingName} has been revoked.`,
        detailsHu: [
          `Érintett társasház: ${buildingName}`,
          `Módosította: ${actorName}`,
          `A társasház könyvelési adataihoz, dokumentumaihoz és ellenőri véleményező nézetéhez tartozó hozzáférésed megszűnt.`,
        ],
        detailsEn: [
          `Condominium: ${buildingName}`,
          `Updated by: ${actorName}`,
          `Your read-only audit access and opinion tools for this condominium have been revoked.`,
        ],
        meta: {
          action: 'revoked',
          buildingId,
          buildingName,
          auditorType: prevAuditor?.type || 'external',
          flatNum: prevAuditor?.flatNum || null,
        },
      })
    );
  }

  // 2. Newly appointed auditor
  if (nextEmail && nextEmail !== prevEmail) {
    const periodHu =
      nextAuditor.validFrom || nextAuditor.validTo
        ? `Megbízási időszak: ${nextAuditor.validFrom || 'azonnal'} – ${nextAuditor.validTo || 'határozatlan'}`
        : 'Megbízási időszak: Határozatlan idejű';
    const periodEn =
      nextAuditor.validFrom || nextAuditor.validTo
        ? `Engagement period: ${nextAuditor.validFrom || 'immediate'} – ${nextAuditor.validTo || 'indefinite'}`
        : 'Engagement period: Indefinite';

    notifs.push(
      buildNotification({
        recipientEmail: nextEmail,
        buildingId,
        buildingName,
        type: 'auditor_updated',
        severity: 'info',
        actorUser,
        flatNum: nextAuditor?.type === 'internal' ? nextAuditor.flatNum || null : null,
        targetProfile: makeTargetProfile(nextAuditor),
        titleHu: `Gazdasági ellenőrzést segítő személy megbízás — ${buildingName}`,
        titleEn: `Appointed as Financial Auditor — ${buildingName}`,
        messageHu: `Kijelöltek a(z) ${buildingName} társasház gazdasági ellenőrzést segítő személyének (Tht. 51/A. §). A jobb felső Profilváltás gombbal vagy az alábbi gombbal bármikor beléphetsz az ellenőri nézetbe.`,
        messageEn: `You have been appointed as Financial Auditor (Tht. § 51/A) for ${buildingName}. Use the Switch Profile button or the action below to open the audit view.`,
        detailsHu: [
          `Érintett társasház: ${buildingName} • Típus: ${nextAuditor.type === 'internal' ? 'Belsős (tulajdonos)' : 'Külsős szakember'}`,
          periodHu,
          `Kijelölte: ${actorName}`,
          `👁️ Mikhez férsz hozzá ellenőri nézetben?\n• Könyvelés, bizonylatok, bankkivonatok és számlák teljes, csak olvasási átvizsgálása (Főmenü & Pénzügyek).\n• Lakások adatai, hitelek, dokumentumok, szerződések és a Közgyűlési éves elszámolás megtekintése / Excel letöltése.\n• Ellenőri vélemények & Észrevételek menüpont: hivatalos írásbeli szakmai vélemény (PDF/DOCX) feltöltése a közgyűlésre, valamint szakmai észrevételek és kockázatjelzések küldése az SZVB és a Közös Képviselet felé.`,
          `🔒 Korlátozások: A szerepkör tisztán ellenőrző és véleményező — könyvelési tételek, lakásadatok, bankszámlák és dokumentumok nem módosíthatók és nem törölhetők.`,
        ],
        detailsEn: [
          `Condominium: ${buildingName} • Type: ${nextAuditor.type === 'internal' ? 'Internal (Owner)' : 'External Professional'}`,
          periodEn,
          `Appointed by: ${actorName}`,
          `👁️ What you can do in Financial Auditor view:\n• Inspect full accounting records, receipts, bank balances, and invoices in read-only mode (Dashboard & Finances).\n• Inspect flats master data, loans, contracts/documents, and General Assembly annual statements (with Excel export).\n• Audit Opinions & Observations menu: upload your official written professional opinion (PDF/DOCX) for the general assembly and log risk flags / professional advice for the SZVB and Common Representative.`,
          `🔒 Restrictions: Strictly read-only & advisory — accounting entries, flat data, bank accounts, and building documents cannot be edited or deleted.`,
        ],
        meta: {
          action: 'granted',
          buildingId,
          buildingName,
          auditorType: nextAuditor.type || 'external',
          flatNum: nextAuditor.flatNum || null,
        },
      })
    );
  }

  return notifs;
}

/**
 * Resolve notification recipients (SZVB + Managing KK + Auditor) for audit opinions & observations.
 */
export function buildAuditActivityNotifications({
  kind = 'opinion', // 'opinion' | 'observation' | 'comment'
  building,
  actorUser,
  item,
  commentText = '',
  organizations = [],
  users = [],
}) {
  if (!building || !item) return [];

  const buildingId = building.id || '';
  const buildingName = building.name || 'Társasház';
  const actorEmail = normalizeEmail(actorUser?.email);
  const actorName = actorUser?.name || actorUser?.email || 'Felhasználó';
  const notifs = [];
  const sentKeys = new Set();

  const pushUnique = (recipientEmail, targetProfile, payload) => {
    const cleanEmail = normalizeEmail(recipientEmail);
    if (!cleanEmail || cleanEmail === actorEmail) return;
    const dedupeKey = `${cleanEmail}|${targetProfile?.type || 'any'}|${targetProfile?.flatNum || ''}`;
    if (sentKeys.has(dedupeKey)) return;
    sentKeys.add(dedupeKey);
    notifs.push(
      buildNotification({
        recipientEmail: cleanEmail,
        buildingId,
        buildingName,
        actorUser,
        flatNum: targetProfile?.flatNum || null,
        targetProfile,
        ...payload,
      })
    );
  };

  let payload;
  if (kind === 'opinion') {
    payload = {
      type: 'audit_opinion',
      severity: 'info',
      titleHu: `Új ellenőri írásbeli vélemény — ${buildingName}`,
      titleEn: `New Written Audit Opinion — ${buildingName}`,
      messageHu: `${actorName} feltöltötte a(z) ${item.year || ''}. évi írásbeli szakmai véleményét: „${item.title}”.`,
      messageEn: `${actorName} submitted a written audit opinion for ${item.year || ''}: "${item.title}".`,
      detailsHu: [
        `Társasház: ${buildingName}`,
        `Cím: ${item.title}`,
        item.summary ? `Összefoglaló: ${item.summary}` : null,
        item.fileName ? `Csatolt dokumentum: ${item.fileName}` : null,
      ].filter(Boolean),
      detailsEn: [
        `Condominium: ${buildingName}`,
        `Title: ${item.title}`,
        item.summary ? `Summary: ${item.summary}` : null,
        item.fileName ? `Attached document: ${item.fileName}` : null,
      ].filter(Boolean),
      meta: { buildingId, opinionId: item.id, kind: 'opinion' },
    };
  } else if (kind === 'observation') {
    const sevHu =
      item.severity === 'critical'
        ? 'Súlyos hiba / kockázat'
        : item.severity === 'warning'
        ? 'Figyelmeztetés'
        : 'Tájékoztató';
    const sevEn =
      item.severity === 'critical'
        ? 'Critical risk / error'
        : item.severity === 'warning'
        ? 'Warning'
        : 'Info';
    payload = {
      type: 'audit_observation',
      severity: item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'warning' : 'info',
      titleHu: `Új ellenőri észrevétel (${sevHu}) — ${buildingName}`,
      titleEn: `New Audit Observation (${sevEn}) — ${buildingName}`,
      messageHu: `${actorName} új szakmai észrevételt rögzített: „${item.title}”.`,
      messageEn: `${actorName} logged a new audit observation: "${item.title}".`,
      detailsHu: [
        `Társasház: ${buildingName} • Súlyosság: ${sevHu}`,
        item.linkedTxLabel ? `Kapcsolódó tétel: ${item.linkedTxLabel}` : null,
        item.description || null,
      ].filter(Boolean),
      detailsEn: [
        `Condominium: ${buildingName} • Severity: ${sevEn}`,
        item.linkedTxLabel ? `Linked entry: ${item.linkedTxLabel}` : null,
        item.description || null,
      ].filter(Boolean),
      meta: { buildingId, observationId: item.id, kind: 'observation' },
    };
  } else {
    payload = {
      type: 'audit_observation',
      severity: 'info',
      titleHu: `Új hozzászólás az ellenőri észrevételhez — ${buildingName}`,
      titleEn: `New Comment on Audit Observation — ${buildingName}`,
      messageHu: `${actorName} hozzászólt a(z) „${item.title}” észrevételhez: „${String(commentText || '').slice(0, 140)}”`,
      messageEn: `${actorName} commented on "${item.title}": "${String(commentText || '').slice(0, 140)}"`,
      detailsHu: [`Társasház: ${buildingName}`, `Észrevétel: ${item.title}`, commentText].filter(Boolean),
      detailsEn: [`Condominium: ${buildingName}`, `Observation: ${item.title}`, commentText].filter(Boolean),
      meta: { buildingId, observationId: item.id, kind: 'comment' },
    };
  }

  // 1. Notify SZVB members (in their linked Owner apartment profile)
  const szvbList = [];
  if (building.szvb?.chairperson?.email) szvbList.push(building.szvb.chairperson);
  if (Array.isArray(building.szvb?.members)) {
    for (const m of building.szvb.members) {
      if (m?.email) szvbList.push(m);
    }
  }
  for (const m of szvbList) {
    pushUnique(
      m.email,
      { type: 'owner', buildingId, flatNum: m.flatNum ? String(m.flatNum) : null },
      payload
    );
  }

  // 2. Notify Economic Auditor (for comments from SZVB or KK)
  if (isEconomicAuditorActive(building.economicAuditor)) {
    const aud = building.economicAuditor;
    const audProfile =
      aud.type === 'internal' && aud.flatNum
        ? { type: 'owner', buildingId, flatNum: String(aud.flatNum) }
        : { type: 'auditor', buildingId, flatNum: null };
    pushUnique(aud.email, audProfile, payload);
  }

  // 3. Notify Managing KK (Organization owner + active staff assigned to this building, or legacy admin)
  const org = findOrganizationForBuilding(building, organizations);
  if (org) {
    if (org.ownerEmail) {
      pushUnique(org.ownerEmail, { type: 'kk', buildingId: null, flatNum: null }, payload);
    }
    for (const mem of org.members || []) {
      if (!mem || mem.active === false || !mem.email) continue;
      const hasAccess =
        mem.orgRole === 'owner' ||
        mem.buildingScope === 'all' ||
        (Array.isArray(mem.buildingIds) && mem.buildingIds.includes(buildingId));
      if (hasAccess) {
        pushUnique(mem.email, { type: 'kk', buildingId: null, flatNum: null }, payload);
      }
    }
  } else {
    for (const u of users || []) {
      if (u && (u.role === 'admin' || u.role === 'superadmin') && u.email) {
        pushUnique(u.email, { type: 'kk', buildingId: null, flatNum: null }, payload);
      }
    }
  }

  return notifs;
}
