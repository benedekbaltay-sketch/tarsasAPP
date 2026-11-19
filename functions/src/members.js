/**
 * Atomic Multi-Tenant Building, RBAC Membership & Unit Lifecycle Management
 *
 * Guarantees server-only control over:
 *   - buildings/{buildingId}/members/{uid} (role, unitIds, active, accessFromDate)
 *   - users/{uid}.memberships
 *   - buildings/{buildingId}/units/{unitId}.ownerUids[]
 *   - buildings/{buildingId}.aggregates.totalUnitCount / settledUnitCount
 *   - Immutable auditLogs entries
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { assertBuildingAdmin } from './authGuard.js';
import { slugifyUnitId, computeUnitArrearsContribution } from './financeMath.js';

const ALLOWED_MEMBER_ROLES = new Set(['admin', 'szvb', 'owner']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

const DEFAULT_SEED_CATEGORIES = [
  { id: 'cat-inc-kk', nameHu: 'Közös Költség befizetés', nameEn: 'Common Cost Payment', type: 'income', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['közös költség', 'kozos koltseg', 'kk'], isSystem: true, isActive: true, sortOrder: 1 },
  { id: 'cat-inc-fa', nameHu: 'Felújítási Alap befizetés', nameEn: 'Renovation Fund Payment', type: 'income', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['felújítási', 'felujitasi', 'fa'], isSystem: true, isActive: true, sortOrder: 2 },
  { id: 'cat-inc-extra', nameHu: 'Rendkívüli célbefizetés', nameEn: 'Special Assessment', type: 'income', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['célbefizetés', 'celbefizetes'], isSystem: true, isActive: true, sortOrder: 3 },
  { id: 'cat-inc-rent', nameHu: 'Helyiségbérlet / Reklámbevétel', nameEn: 'Rental / Advertising Income', type: 'income', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['bérleti', 'reklám'], isSystem: true, isActive: true, sortOrder: 4 },
  { id: 'cat-inc-interest', nameHu: 'Kamatbevétel', nameEn: 'Interest Income', type: 'income', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['kamat'], isSystem: true, isActive: true, sortOrder: 5 },
  { id: 'cat-inc-other', nameHu: 'Egyéb jóváírás', nameEn: 'Other Income', type: 'income', defaultFund: 'KK', allocationBasis: 'direct', keywords: [], isSystem: true, isActive: true, sortOrder: 6 },
  { id: 'cat-exp-utility', nameHu: 'Közüzemi díj (Víz, Gáz, Áram)', nameEn: 'Utilities (Water, Gas, Electricity)', type: 'expense', defaultFund: 'KK', allocationBasis: 'meter', keywords: ['mvm', 'vízművek', 'vizmuvek', 'főgáz', 'elmű', 'főtáv'], isSystem: true, isActive: true, sortOrder: 10 },
  { id: 'cat-exp-garbage', nameHu: 'Szemétszállítás', nameEn: 'Waste Management', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['fkf', 'mohu', 'hulladék', 'szemét'], isSystem: true, isActive: true, sortOrder: 11 },
  { id: 'cat-exp-cleaning', nameHu: 'Takarítás & Kertgondozás', nameEn: 'Cleaning & Gardening', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['takarítás', 'kert'], isSystem: true, isActive: true, sortOrder: 12 },
  { id: 'cat-exp-maintenance', nameHu: 'Karbantartás & Kisjavítás', nameEn: 'Maintenance & Repairs', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['karbantartás', 'javítás', 'szerelés'], isSystem: true, isActive: true, sortOrder: 13 },
  { id: 'cat-exp-renovation', nameHu: 'Felújítási munkálatok', nameEn: 'Renovation Works', type: 'expense', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['felújítás', 'kivitelezés'], isSystem: true, isActive: true, sortOrder: 14 },
  { id: 'cat-exp-insurance', nameHu: 'Épületbiztosítás', nameEn: 'Building Insurance', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['allianz', 'generali', 'alfa', 'groupama', 'biztosítás'], isSystem: true, isActive: true, sortOrder: 15 },
  { id: 'cat-exp-bank', nameHu: 'Bankköltség & Számlavezetés', nameEn: 'Bank Fees & Account Charges', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['számlavezetési', 'tranzakciós illeték', 'bankköltség'], isSystem: true, isActive: true, sortOrder: 16 },
  { id: 'cat-exp-rep', nameHu: 'Közös képviseleti díj', nameEn: 'Condominium Management Fee', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['képviseleti díj', 'közös képviselet'], isSystem: true, isActive: true, sortOrder: 17 },
  { id: 'cat-exp-elevator', nameHu: 'Lift üzemeltetés & Karbantartás', nameEn: 'Elevator Service & Maintenance', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['lift', 'felvonó', 'otis', 'schindler', 'kone'], isSystem: true, isActive: true, sortOrder: 18 },
  { id: 'cat-exp-legal', nameHu: 'Jogi & Könyvelési költség', nameEn: 'Legal & Accounting Fees', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['ügyvédi', 'könyvelés', 'jogtanácsos'], isSystem: true, isActive: true, sortOrder: 19 },
  { id: 'cat-exp-other', nameHu: 'Egyéb kiadás', nameEn: 'Other Expense', type: 'expense', defaultFund: 'KK', allocationBasis: 'direct', keywords: [], isSystem: true, isActive: true, sortOrder: 20 },
];

/**
 * Provision a new condominium building atomically with creator admin membership & default categories.
 */
export const provisionBuilding = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const db = getFirestore();
    const callerUid = request.auth.uid;
    const callerEmail = String(request.auth.token?.email || '').toLowerCase().trim();
    const isSuper = request.auth.token?.superadmin === true;

    // Only SuperAdmins or existing Common Representatives (admin in >= 1 building) may provision new buildings
    if (!isSuper) {
      const userSnap = await db.doc(`users/${callerUid}`).get();
      const memberships = userSnap.data()?.memberships || {};
      const isExistingAdmin = Object.values(memberships).some((m) => m?.active && m?.role === 'admin');
      if (!isExistingAdmin) {
        throw new HttpsError('permission-denied', 'Common Representative or SuperAdmin role is required to create a building.');
      }
    }

    const data = request.data || {};
    const name = String(data.name || '').trim();
    const address = String(data.address || '').trim();
    if (!name) throw new HttpsError('invalid-argument', 'Building name is required.');

    const buildingId = data.id
      ? slugifyUnitId(data.id)
      : `b-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const auditLogId = makeId('audit');

    const initKK = Math.round(Number(data.initialReserveKK) || 0);
    const initFA = Math.round(Number(data.initialReserveFA) || 0);

    const buildingRef = db.doc(`buildings/${buildingId}`);
    const memberRef = db.doc(`buildings/${buildingId}/members/${callerUid}`);
    const userRef = db.doc(`users/${callerUid}`);
    const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(buildingRef);
      if (existing.exists) {
        throw new HttpsError('already-exists', `Building "${buildingId}" already exists.`);
      }
      const nowTs = FieldValue.serverTimestamp();

      tx.set(buildingRef, {
        id: buildingId,
        name,
        address,
        taxNumber: String(data.taxNumber || '').trim(),
        paymentCodePrefix: String(data.paymentCodePrefix || 'TH').trim().slice(0, 16),
        defaultBank: String(data.defaultBank || 'OTP').trim(),
        repContact: {
          name: String(data.repName || '').trim(),
          phone: String(data.phone || '').trim(),
          email: String(data.email || callerEmail).trim(),
          officeHours: String(data.repOfficeHours || '').trim(),
          address: String(data.repAddress || '').trim(),
        },
        bankAccounts: {
          KK: {
            name: String(data.bankKK?.name || name).trim(),
            shortName: 'KK',
            account: String(data.bankKK?.account || '').trim(),
            bank: String(data.bankKK?.bank || 'OTP').trim(),
            hasMonthlyFee: true,
          },
          FA: {
            name: String(data.bankFA?.name || name).trim(),
            shortName: 'FA',
            account: String(data.bankFA?.account || '').trim(),
            bank: String(data.bankFA?.bank || 'OTP').trim(),
            hasMonthlyFee: true,
          },
          custom: [],
        },
        bankApi: {
          provider: 'OTP CorpAPI',
          environment: 'sandbox',
          clientId: '',
          autoSync: false,
          syncInterval: 'daily',
          secretManagedServerSide: true,
        },
        initialReserves: { KK: initKK, FA: initFA, custom: {} },
        balances: { KK: initKK, FA: initFA, custom: {}, totalReserve: initKK + initFA },
        aggregates: {
          totalArrearsHuf: 0,
          totalArrearsKK: 0,
          totalArrearsFA: 0,
          totalOverpaymentHuf: 0,
          debtorUnitCount: 0,
          settledUnitCount: 0,
          totalUnitCount: 0,
          lastRecalculatedAt: nowTs,
        },
        docFolders: [
          { id: 'folder-legal', name: 'Alapdokumentumok & Szabályzatok', color: 'blue', createdAt: new Date().toISOString().slice(0, 10) },
          { id: 'folder-assemblies', name: 'Közgyűlési Jegyzőkönyvek', color: 'amber', createdAt: new Date().toISOString().slice(0, 10) },
          { id: 'folder-financial', name: 'Pénzügyi & Számviteli Beszámolók', color: 'emerald', createdAt: new Date().toISOString().slice(0, 10) },
          { id: 'folder-tech', name: 'Műszaki & Karbantartási Iratok', color: 'indigo', createdAt: new Date().toISOString().slice(0, 10) },
        ],
        createdAt: nowTs,
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });

      tx.set(memberRef, {
        uid: callerUid,
        email: callerEmail,
        role: 'admin',
        unitIds: [],
        active: true,
        accessFromDate: null,
        grantedBy: callerUid,
        grantedAt: nowTs,
        updatedAt: nowTs,
      });

      tx.set(
        userRef,
        {
          uid: callerUid,
          email: callerEmail,
          memberships: {
            [buildingId]: {
              buildingName: name,
              role: 'admin',
              unitIds: [],
              active: true,
            },
          },
          updatedAt: nowTs,
        },
        { merge: true }
      );

      for (const cat of DEFAULT_SEED_CATEGORIES) {
        tx.set(db.doc(`buildings/${buildingId}/categories/${cat.id}`), {
          ...cat,
          createdAt: nowTs,
          updatedAt: nowTs,
        });
      }

      tx.set(auditRef, {
        id: auditLogId,
        buildingId,
        action: 'building.update',
        entityType: 'building',
        entityId: buildingId,
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorRole: isSuper ? 'superadmin' : 'admin',
        timestamp: nowTs,
        summary: `Provisioned condominium "${name}" (${buildingId})`,
        before: null,
        after: { id: buildingId, name, address, initKK, initFA },
      });
    });

    return { success: true, buildingId, auditLogId };
  }
);

/**
 * Grant, update, or revoke a user's RBAC membership (admin / szvb / owner) in a building
 * and atomically synchronize units/{unitId}.ownerUids[] + users/{uid}.memberships + auditLog.
 */
export const manageBuildingMember = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const {
      buildingId,
      targetUid: rawTargetUid,
      targetEmail,
      role,
      unitIds = [],
      active = true,
      accessFromDate = null,
    } = request.data || {};

    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    if (!ALLOWED_MEMBER_ROLES.has(role)) {
      throw new HttpsError('invalid-argument', `Invalid member role: ${role}`);
    }
    if (accessFromDate !== null && accessFromDate !== '' && !ISO_DATE_RE.test(String(accessFromDate))) {
      throw new HttpsError('invalid-argument', 'accessFromDate must be YYYY-MM-DD or null.');
    }

    // Resolve targetUid from Firebase Auth if only email was supplied
    let targetUid = rawTargetUid ? String(rawTargetUid).trim() : null;
    let resolvedEmail = String(targetEmail || '').toLowerCase().trim();
    if (!targetUid) {
      if (!resolvedEmail) {
        throw new HttpsError('invalid-argument', 'Either targetUid or targetEmail is required.');
      }
      try {
        const authUser = await getAuth().getUserByEmail(resolvedEmail);
        targetUid = authUser.uid;
        resolvedEmail = (authUser.email || resolvedEmail).toLowerCase().trim();
      } catch {
        throw new HttpsError('not-found', `No Firebase Auth account found for ${resolvedEmail}.`);
      }
    }

    const cleanUnitIds = Array.isArray(unitIds)
      ? Array.from(new Set(unitIds.map((u) => String(u).trim()).filter(Boolean)))
      : [];

    const auditLogId = makeId('audit');
    const buildingRef = db.doc(`buildings/${buildingId}`);
    const memberRef = db.doc(`buildings/${buildingId}/members/${targetUid}`);
    const userRef = db.doc(`users/${targetUid}`);
    const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

    await db.runTransaction(async (tx) => {
      const buildingSnap = await tx.get(buildingRef);
      if (!buildingSnap.exists) {
        throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
      }

      const prevMemberSnap = await tx.get(memberRef);
      const prevMember = prevMemberSnap.exists ? prevMemberSnap.data() : null;
      const prevUnitIds = Array.isArray(prevMember?.unitIds) ? prevMember.unitIds : [];

      const allTouchedUnitIds = Array.from(new Set([...prevUnitIds, ...cleanUnitIds]));
      const unitSnaps = new Map();
      for (const uId of allTouchedUnitIds) {
        unitSnaps.set(uId, await tx.get(db.doc(`buildings/${buildingId}/units/${uId}`)));
      }

      const nowTs = FieldValue.serverTimestamp();
      const nextMember = {
        uid: targetUid,
        email: resolvedEmail || prevMember?.email || '',
        role,
        unitIds: active ? cleanUnitIds : [],
        active: Boolean(active),
        accessFromDate: accessFromDate ? String(accessFromDate) : null,
        grantedBy: actor.uid,
        grantedAt: prevMember?.grantedAt || nowTs,
        updatedAt: nowTs,
      };

      tx.set(memberRef, nextMember);

      tx.set(
        userRef,
        {
          uid: targetUid,
          email: nextMember.email,
          memberships: {
            [buildingId]: {
              buildingName: buildingSnap.data().name || buildingId,
              role,
              unitIds: nextMember.unitIds,
              active: nextMember.active,
            },
          },
          updatedAt: nowTs,
        },
        { merge: true }
      );

      // Keep units/{unitId}.ownerUids[] 100% synchronized with membership grants/revocations
      for (const uId of allTouchedUnitIds) {
        const uSnap = unitSnaps.get(uId);
        if (!uSnap || !uSnap.exists) continue;
        const currentOwnerUids = new Set(Array.isArray(uSnap.data().ownerUids) ? uSnap.data().ownerUids : []);
        if (nextMember.active && nextMember.unitIds.includes(uId)) {
          currentOwnerUids.add(targetUid);
        } else {
          currentOwnerUids.delete(targetUid);
        }
        tx.update(uSnap.ref, {
          ownerUids: Array.from(currentOwnerUids),
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
      }

      tx.set(auditRef, {
        id: auditLogId,
        buildingId,
        action: nextMember.active ? 'member.grant' : 'member.revoke',
        entityType: 'member',
        entityId: targetUid,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: `${nextMember.active ? 'Granted' : 'Revoked'} role "${role}" for ${nextMember.email || targetUid} (units: ${nextMember.unitIds.join(', ') || 'none'})`,
        before: prevMember,
        after: nextMember,
      });
    });

    return { success: true, targetUid, auditLogId };
  }
);

/**
 * Atomically create or delete a unit document while keeping building aggregates & audit logs consistent.
 */
export const manageUnitLifecycle = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { action, buildingId, unitId: rawUnitId, unitData } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);
    const auditLogId = makeId('audit');

    if (action === 'create') {
      const unitCode = String(unitData?.unitCode || unitData?.flatNum || '').trim();
      if (!unitCode) throw new HttpsError('invalid-argument', 'unitCode is required.');
      const unitId = rawUnitId ? slugifyUnitId(rawUnitId) : slugifyUnitId(unitCode);

      const buildingRef = db.doc(`buildings/${buildingId}`);
      const unitRef = db.doc(`buildings/${buildingId}/units/${unitId}`);
      const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

      await db.runTransaction(async (tx) => {
        const bSnap = await tx.get(buildingRef);
        if (!bSnap.exists) throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
        const uSnap = await tx.get(unitRef);
        if (uSnap.exists) throw new HttpsError('already-exists', `Unit "${unitId}" already exists.`);

        const nowTs = FieldValue.serverTimestamp();
        const initKK = Math.round(Number(unitData.initialKK) || 0);
        const initFA = Math.round(Number(unitData.initialFA) || 0);
        const balances = {
          initialKK: initKK,
          initialFA: initFA,
          customInitial: {},
          KK: initKK,
          FA: initFA,
          custom: {},
          total: initKK + initFA,
          isDebtor: initKK + initFA < 0,
          totalRequiredKK: 0,
          totalPaidKK: 0,
          totalRequiredFA: 0,
          totalPaidFA: 0,
        };

        const contrib = computeUnitArrearsContribution(balances);
        const oldAgg = bSnap.data().aggregates || {};
        const nextAgg = {
          totalArrearsHuf: (Number(oldAgg.totalArrearsHuf) || 0) + contrib.totalDebt,
          totalArrearsKK: (Number(oldAgg.totalArrearsKK) || 0) + contrib.kkDebt,
          totalArrearsFA: (Number(oldAgg.totalArrearsFA) || 0) + contrib.faDebt,
          totalOverpaymentHuf: (Number(oldAgg.totalOverpaymentHuf) || 0) + contrib.overpayment,
          debtorUnitCount: (Number(oldAgg.debtorUnitCount) || 0) + (contrib.isDebtor ? 1 : 0),
          settledUnitCount: (Number(oldAgg.settledUnitCount) || 0) + (contrib.isDebtor ? 0 : 1),
          totalUnitCount: (Number(oldAgg.totalUnitCount) || 0) + 1,
          lastRecalculatedAt: nowTs,
        };

        // Strip any legacy plaintext password fields defensively
        const { pass, password, resetToken, resetTokenExpiry, ...safeInput } = unitData || {};

        tx.set(unitRef, {
          id: unitId,
          buildingId,
          ownerUids: [],
          unitCode,
          unitType: safeInput.unitType || 'flat',
          staircase: String(safeInput.staircase || ''),
          floor: String(safeInput.floor || ''),
          door: String(safeInput.door || ''),
          hrsz: String(safeInput.hrsz || ''),
          areaSqm: Number(safeInput.areaSqm ?? safeInput.area ?? 0) || 0,
          volumeCbm: Number(safeInput.volumeCbm ?? safeInput.volume ?? 0) || 0,
          terraceAreaSqm: Number(safeInput.terraceAreaSqm ?? safeInput.terraceArea ?? 0) || 0,
          ownershipSharePct: Number(safeInput.ownershipSharePct ?? safeInput.ownershipShare ?? 0) || 0,
          residentsCount: Number(safeInput.residentsCount ?? safeInput.tenantCount ?? 1) || 1,
          paymentCode: String(safeInput.paymentCode || unitCode),
          purchaseDate: String(safeInput.purchaseDate || ''),
          saleDate: String(safeInput.saleDate || ''),
          isCompany: Boolean(safeInput.isCompany),
          excludeUtility: Boolean(safeInput.excludeUtility),
          notes: String(safeInput.notes || ''),
          phone: String(safeInput.phone || ''),
          emergencyContact: String(safeInput.emergencyContact || ''),
          ownerDisplayName: String(safeInput.ownerDisplayName || safeInput.ownerName || ''),
          owners: Array.isArray(safeInput.owners) ? safeInput.owners : [],
          tenants: Array.isArray(safeInput.tenants) ? safeInput.tenants : [],
          meters: Array.isArray(safeInput.meters) ? safeInput.meters : [],
          accessories: Array.isArray(safeInput.accessories || safeInput.annexes) ? (safeInput.accessories || safeInput.annexes) : [],
          fees: {
            startDateKK: safeInput.startDateKK || new Date().toISOString().slice(0, 7) + '-01',
            startDateFA: safeInput.startDateFA || new Date().toISOString().slice(0, 7) + '-01',
            monthlyFeeKK: Math.round(Number(safeInput.monthlyFeeKK ?? safeInput.monthlyFee ?? 0) || 0),
            monthlyFeeFA: Math.round(Number(safeInput.monthlyFeeFA ?? safeInput.renovationFee ?? 0) || 0),
            customFees: safeInput.customFees || {},
            feeChangesKK: safeInput.feeChangesKK || [],
            feeChangesFA: safeInput.feeChangesFA || [],
          },
          balances,
          activeLoanShares: [],
          createdAt: nowTs,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });

        tx.update(buildingRef, {
          aggregates: nextAgg,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });

        tx.set(auditRef, {
          id: auditLogId,
          buildingId,
          action: 'unit.create',
          entityType: 'unit',
          entityId: unitId,
          actorUid: actor.uid,
          actorEmail: actor.email || '',
          actorRole: actor.role,
          timestamp: nowTs,
          summary: `Created unit "${unitCode}" (${unitId})`,
          before: null,
          after: { id: unitId, unitCode, unitType: safeInput.unitType || 'flat' },
        });
      });

      return { success: true, unitId, auditLogId };
    }

    if (action === 'delete') {
      const unitId = String(rawUnitId || '').trim();
      if (!unitId) throw new HttpsError('invalid-argument', 'unitId is required for delete.');

      const buildingRef = db.doc(`buildings/${buildingId}`);
      const unitRef = db.doc(`buildings/${buildingId}/units/${unitId}`);
      const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

      await db.runTransaction(async (tx) => {
        const bSnap = await tx.get(buildingRef);
        const uSnap = await tx.get(unitRef);
        if (!bSnap.exists || !uSnap.exists) {
          throw new HttpsError('not-found', 'Building or unit not found.');
        }

        const uData = uSnap.data();
        const contrib = computeUnitArrearsContribution(uData.balances || {});
        const oldAgg = bSnap.data().aggregates || {};
        const nowTs = FieldValue.serverTimestamp();

        const nextAgg = {
          totalArrearsHuf: Math.max(0, (Number(oldAgg.totalArrearsHuf) || 0) - contrib.totalDebt),
          totalArrearsKK: Math.max(0, (Number(oldAgg.totalArrearsKK) || 0) - contrib.kkDebt),
          totalArrearsFA: Math.max(0, (Number(oldAgg.totalArrearsFA) || 0) - contrib.faDebt),
          totalOverpaymentHuf: Math.max(0, (Number(oldAgg.totalOverpaymentHuf) || 0) - contrib.overpayment),
          debtorUnitCount: Math.max(0, (Number(oldAgg.debtorUnitCount) || 0) - (contrib.isDebtor ? 1 : 0)),
          settledUnitCount: Math.max(0, (Number(oldAgg.settledUnitCount) || 0) - (contrib.isDebtor ? 0 : 1)),
          totalUnitCount: Math.max(0, (Number(oldAgg.totalUnitCount) || 0) - 1),
          lastRecalculatedAt: nowTs,
        };

        tx.delete(unitRef);
        tx.update(buildingRef, {
          aggregates: nextAgg,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
        tx.set(auditRef, {
          id: auditLogId,
          buildingId,
          action: 'unit.delete',
          entityType: 'unit',
          entityId: unitId,
          actorUid: actor.uid,
          actorEmail: actor.email || '',
          actorRole: actor.role,
          timestamp: nowTs,
          summary: `Deleted unit "${uData.unitCode || unitId}"`,
          before: uData,
          after: null,
        });
      });

      return { success: true, unitId, auditLogId };
    }

    throw new HttpsError('invalid-argument', `Unsupported unit action: ${action}`);
  }
);
