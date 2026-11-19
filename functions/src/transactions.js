/**
 * Atomic Cloud Firestore Financial Mutation Engine
 *
 * Guarantees that every transaction create/edit/delete and balance calibration
 * updates:
 *   1. buildings/{bId}/transactions/{txId}
 *   2. buildings/{bId}/units/{unitId}.balances
 *   3. buildings/{bId}.balances (KK/FA/custom bank reserves) + buildings/{bId}.aggregates (totalArrearsHuf)
 *   4. buildings/{bId}/monthlySummaries/{YYYY-MM}
 *   5. buildings/{bId}/auditLogs/{logId} (immutable)
 * in ONE atomic Firestore runTransaction (all succeed or all roll back).
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { assertBuildingAdmin } from './authGuard.js';
import {
  validateTransactionPayload,
  computeTxImpacts,
  applyUnitBalanceDelta,
  applyBuildingBankDelta,
  applyAggregatesTransitions,
  applyMonthlySummaryDelta,
  normalizeFundKey,
} from './financeMath.js';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Pure core transaction: CREATE a financial transaction atomically.
 */
export async function executeCreateTransaction(db, fieldValue, buildingId, rawPayload, actor) {
  const newTx = validateTransactionPayload(rawPayload);
  const txId = rawPayload.id
    ? String(rawPayload.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
    : makeId(newTx.kind === 'expense' ? 'exp' : newTx.kind === 'debit' ? 'deb' : 'tx');
  const auditLogId = makeId('audit');

  const buildingRef = db.doc(`buildings/${buildingId}`);
  const txRef = db.doc(`buildings/${buildingId}/transactions/${txId}`);
  const unitRef = newTx.unitId ? db.doc(`buildings/${buildingId}/units/${newTx.unitId}`) : null;
  const monthRef = db.doc(`buildings/${buildingId}/monthlySummaries/${newTx.yearMonth}`);
  const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

  return db.runTransaction(async (tx) => {
    // === PHASE 1: ALL READS FIRST ===
    const buildingSnap = await tx.get(buildingRef);
    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const existingTxSnap = await tx.get(txRef);
    if (existingTxSnap.exists) {
      // Idempotent guard (e.g. duplicate bank import or monthly assessment retry)
      return {
        success: true,
        duplicate: true,
        txId,
        auditLogId: existingTxSnap.data()?.lastAuditLogId || null,
      };
    }

    const unitSnap = unitRef ? await tx.get(unitRef) : null;
    if (unitRef && (!unitSnap || !unitSnap.exists)) {
      throw new HttpsError('not-found', `Unit "${newTx.unitId}" not found in building "${buildingId}".`);
    }

    const monthSnap = await tx.get(monthRef);

    // === PHASE 2: PURE DELTA CALCULATION ===
    const nowTs = fieldValue.serverTimestamp();
    const buildingData = buildingSnap.data();
    const impacts = computeTxImpacts(newTx);

    let nextUnitBalances = null;
    const unitTransitions = [];
    let resolvedUnitCode = newTx.unitCode;

    if (unitSnap) {
      const unitData = unitSnap.data();
      resolvedUnitCode = unitData.unitCode || newTx.unitCode || newTx.unitId;
      const oldUnitBal = unitData.balances || {};
      nextUnitBalances = applyUnitBalanceDelta(
        oldUnitBal,
        newTx.fund,
        impacts.signedUnitDeltaHuf,
        impacts.requiredDelta,
        impacts.paidDelta
      );
      unitTransitions.push({ before: oldUnitBal, after: nextUnitBalances });
    }

    const nextBuildingBalances = applyBuildingBankDelta(
      buildingData.balances || {},
      newTx.fund,
      impacts.signedBankDeltaHuf
    );

    const nextAggregates = applyAggregatesTransitions(
      buildingData.aggregates || {},
      unitTransitions
    );
    const arrearsDeltaHuf =
      nextAggregates.totalArrearsHuf - Math.round(Number(buildingData.aggregates?.totalArrearsHuf) || 0);

    const nextMonthSummary = applyMonthlySummaryDelta(
      monthSnap.exists ? monthSnap.data() : null,
      newTx.yearMonth,
      newTx.fund,
      impacts.monthlyInflowDelta,
      impacts.monthlyOutflowDelta
    );

    const txDoc = {
      id: txId,
      buildingId,
      ...newTx,
      unitCode: resolvedUnitCode,
      createdAt: nowTs,
      createdBy: actor.uid,
      updatedAt: nowTs,
      updatedBy: actor.uid,
      lastAuditLogId: auditLogId,
    };

    const auditDoc = {
      id: auditLogId,
      buildingId,
      action: newTx.kind === 'assessment' ? 'assessment.generate' : 'tx.create',
      entityType: 'transaction',
      entityId: txId,
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: actor.role,
      timestamp: nowTs,
      summary: `${newTx.kind} ${newTx.amountHuf} HUF (${newTx.fund})${resolvedUnitCode ? ` — ${resolvedUnitCode}` : ''}`,
      before: null,
      after: {
        id: txId,
        kind: newTx.kind,
        unitId: newTx.unitId,
        unitCode: resolvedUnitCode,
        fund: newTx.fund,
        direction: newTx.direction,
        amountHuf: newTx.amountHuf,
        date: newTx.date,
        paymentMethod: newTx.paymentMethod,
        comment: newTx.comment,
      },
      deltas: {
        unitId: newTx.unitId,
        fund: newTx.fund,
        unitBalanceDeltaHuf: impacts.signedUnitDeltaHuf,
        bankBalanceDeltaHuf: impacts.signedBankDeltaHuf,
        buildingArrearsDeltaHuf: arrearsDeltaHuf,
      },
    };

    // === PHASE 3: ALL WRITES ATOMICALLY ===
    tx.set(txRef, txDoc);

    if (unitRef && nextUnitBalances) {
      tx.update(unitRef, {
        balances: nextUnitBalances,
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });
    }

    tx.update(buildingRef, {
      balances: nextBuildingBalances,
      aggregates: {
        ...nextAggregates,
        lastRecalculatedAt: nowTs,
      },
      updatedAt: nowTs,
      lastAuditLogId: auditLogId,
    });

    if (impacts.monthlyInflowDelta !== 0 || impacts.monthlyOutflowDelta !== 0 || !monthSnap.exists) {
      tx.set(
        monthRef,
        {
          ...nextMonthSummary,
          updatedAt: nowTs,
        },
        { merge: true }
      );
    }

    tx.set(auditRef, auditDoc);

    return {
      success: true,
      duplicate: false,
      txId,
      auditLogId,
      buildingBalances: nextBuildingBalances,
      buildingAggregates: nextAggregates,
      unitBalances: nextUnitBalances,
    };
  });
}

/**
 * Pure core transaction: UPDATE an existing financial transaction atomically.
 * Safely handles edits changing amount, fund, payment method, unitId, or month!
 */
export async function executeUpdateTransaction(db, fieldValue, buildingId, txId, rawPayload, actor) {
  if (!txId || typeof txId !== 'string') {
    throw new HttpsError('invalid-argument', 'txId is required for update.');
  }

  const nextTx = validateTransactionPayload(rawPayload);
  const auditLogId = makeId('audit');

  const buildingRef = db.doc(`buildings/${buildingId}`);
  const txRef = db.doc(`buildings/${buildingId}/transactions/${txId}`);
  const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

  return db.runTransaction(async (tx) => {
    // === PHASE 1: ALL READS FIRST ===
    const buildingSnap = await tx.get(buildingRef);
    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const oldTxSnap = await tx.get(txRef);
    if (!oldTxSnap.exists) {
      throw new HttpsError('not-found', `Transaction "${txId}" not found.`);
    }

    const oldTx = oldTxSnap.data();

    const oldUnitId = oldTx.unitId || null;
    const newUnitId = nextTx.unitId || null;
    const sameUnit = oldUnitId === newUnitId;

    const oldUnitRef = oldUnitId ? db.doc(`buildings/${buildingId}/units/${oldUnitId}`) : null;
    const newUnitRef = newUnitId && !sameUnit ? db.doc(`buildings/${buildingId}/units/${newUnitId}`) : oldUnitRef;

    const oldUnitSnap = oldUnitRef ? await tx.get(oldUnitRef) : null;
    const newUnitSnap = newUnitRef && newUnitRef !== oldUnitRef ? await tx.get(newUnitRef) : oldUnitSnap;

    if (newUnitId && (!newUnitSnap || !newUnitSnap.exists)) {
      throw new HttpsError('not-found', `Target unit "${newUnitId}" not found.`);
    }

    const oldMonthRef = db.doc(`buildings/${buildingId}/monthlySummaries/${oldTx.yearMonth}`);
    const sameMonth = oldTx.yearMonth === nextTx.yearMonth;
    const newMonthRef = sameMonth
      ? oldMonthRef
      : db.doc(`buildings/${buildingId}/monthlySummaries/${nextTx.yearMonth}`);

    const oldMonthSnap = await tx.get(oldMonthRef);
    const newMonthSnap = sameMonth ? oldMonthSnap : await tx.get(newMonthRef);

    // === PHASE 2: PURE REVERSAL + RE-APPLICATION MATH ===
    const nowTs = fieldValue.serverTimestamp();
    const buildingData = buildingSnap.data();

    const oldImpacts = computeTxImpacts(oldTx);
    const newImpacts = computeTxImpacts(nextTx);

    const unitTransitions = [];
    let oldUnitNextBalances = null;
    let newUnitNextBalances = null;

    if (sameUnit && oldUnitId && oldUnitSnap?.exists) {
      const beforeBal = oldUnitSnap.data().balances || {};
      const afterReverse = applyUnitBalanceDelta(
        beforeBal,
        oldTx.fund,
        -oldImpacts.signedUnitDeltaHuf,
        -oldImpacts.requiredDelta,
        -oldImpacts.paidDelta
      );
      const afterApply = applyUnitBalanceDelta(
        afterReverse,
        nextTx.fund,
        newImpacts.signedUnitDeltaHuf,
        newImpacts.requiredDelta,
        newImpacts.paidDelta
      );
      oldUnitNextBalances = afterApply;
      newUnitNextBalances = afterApply;
      unitTransitions.push({ before: beforeBal, after: afterApply });
    } else {
      if (oldUnitId && oldUnitSnap?.exists) {
        const beforeOld = oldUnitSnap.data().balances || {};
        oldUnitNextBalances = applyUnitBalanceDelta(
          beforeOld,
          oldTx.fund,
          -oldImpacts.signedUnitDeltaHuf,
          -oldImpacts.requiredDelta,
          -oldImpacts.paidDelta
        );
        unitTransitions.push({ before: beforeOld, after: oldUnitNextBalances });
      }
      if (newUnitId && newUnitSnap?.exists) {
        const beforeNew = newUnitSnap.data().balances || {};
        newUnitNextBalances = applyUnitBalanceDelta(
          beforeNew,
          nextTx.fund,
          newImpacts.signedUnitDeltaHuf,
          newImpacts.requiredDelta,
          newImpacts.paidDelta
        );
        unitTransitions.push({ before: beforeNew, after: newUnitNextBalances });
      }
    }

    // Reverse old bank delta, then apply new bank delta
    const bankAfterReverse = applyBuildingBankDelta(
      buildingData.balances || {},
      oldTx.fund,
      -oldImpacts.signedBankDeltaHuf
    );
    const nextBuildingBalances = applyBuildingBankDelta(
      bankAfterReverse,
      nextTx.fund,
      newImpacts.signedBankDeltaHuf
    );

    const nextAggregates = applyAggregatesTransitions(
      buildingData.aggregates || {},
      unitTransitions
    );
    const arrearsDeltaHuf =
      nextAggregates.totalArrearsHuf - Math.round(Number(buildingData.aggregates?.totalArrearsHuf) || 0);

    // Monthly summary updates
    let nextOldMonth = applyMonthlySummaryDelta(
      oldMonthSnap.exists ? oldMonthSnap.data() : null,
      oldTx.yearMonth,
      oldTx.fund,
      -oldImpacts.monthlyInflowDelta,
      -oldImpacts.monthlyOutflowDelta
    );

    let nextNewMonth = null;
    if (sameMonth) {
      nextOldMonth = applyMonthlySummaryDelta(
        nextOldMonth,
        nextTx.yearMonth,
        nextTx.fund,
        newImpacts.monthlyInflowDelta,
        newImpacts.monthlyOutflowDelta
      );
    } else {
      nextNewMonth = applyMonthlySummaryDelta(
        newMonthSnap.exists ? newMonthSnap.data() : null,
        nextTx.yearMonth,
        nextTx.fund,
        newImpacts.monthlyInflowDelta,
        newImpacts.monthlyOutflowDelta
      );
    }

    const resolvedUnitCode = newUnitId
      ? (newUnitSnap?.data()?.unitCode || nextTx.unitCode || newUnitId)
      : null;

    const updatedTxDoc = {
      ...oldTx,
      ...nextTx,
      id: txId,
      buildingId,
      unitCode: resolvedUnitCode,
      updatedAt: nowTs,
      updatedBy: actor.uid,
      lastAuditLogId: auditLogId,
    };

    const auditDoc = {
      id: auditLogId,
      buildingId,
      action: 'tx.update',
      entityType: 'transaction',
      entityId: txId,
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: actor.role,
      timestamp: nowTs,
      summary: `Updated ${txId}: ${oldTx.amountHuf} (${oldTx.fund}) -> ${nextTx.amountHuf} HUF (${nextTx.fund})`,
      before: {
        kind: oldTx.kind,
        unitId: oldTx.unitId,
        fund: oldTx.fund,
        direction: oldTx.direction,
        amountHuf: oldTx.amountHuf,
        date: oldTx.date,
        paymentMethod: oldTx.paymentMethod,
        comment: oldTx.comment,
      },
      after: {
        kind: nextTx.kind,
        unitId: nextTx.unitId,
        fund: nextTx.fund,
        direction: nextTx.direction,
        amountHuf: nextTx.amountHuf,
        date: nextTx.date,
        paymentMethod: nextTx.paymentMethod,
        comment: nextTx.comment,
      },
      deltas: {
        unitId: newUnitId,
        fund: nextTx.fund,
        unitBalanceDeltaHuf: newImpacts.signedUnitDeltaHuf - oldImpacts.signedUnitDeltaHuf,
        bankBalanceDeltaHuf: newImpacts.signedBankDeltaHuf - oldImpacts.signedBankDeltaHuf,
        buildingArrearsDeltaHuf: arrearsDeltaHuf,
      },
    };

    // === PHASE 3: ALL WRITES ATOMICALLY ===
    tx.set(txRef, updatedTxDoc);

    if (sameUnit && oldUnitRef && oldUnitNextBalances) {
      tx.update(oldUnitRef, {
        balances: oldUnitNextBalances,
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });
    } else {
      if (oldUnitRef && oldUnitNextBalances) {
        tx.update(oldUnitRef, {
          balances: oldUnitNextBalances,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
      }
      if (newUnitRef && newUnitRef !== oldUnitRef && newUnitNextBalances) {
        tx.update(newUnitRef, {
          balances: newUnitNextBalances,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
      }
    }

    tx.update(buildingRef, {
      balances: nextBuildingBalances,
      aggregates: {
        ...nextAggregates,
        lastRecalculatedAt: nowTs,
      },
      updatedAt: nowTs,
      lastAuditLogId: auditLogId,
    });

    tx.set(oldMonthRef, { ...nextOldMonth, updatedAt: nowTs }, { merge: true });
    if (!sameMonth && nextNewMonth) {
      tx.set(newMonthRef, { ...nextNewMonth, updatedAt: nowTs }, { merge: true });
    }

    tx.set(auditRef, auditDoc);

    return {
      success: true,
      txId,
      auditLogId,
      buildingBalances: nextBuildingBalances,
      buildingAggregates: nextAggregates,
    };
  });
}

/**
 * Pure core transaction: DELETE a financial transaction atomically (with full audit preservation).
 */
export async function executeDeleteTransaction(db, fieldValue, buildingId, txId, reason, actor) {
  if (!txId || typeof txId !== 'string') {
    throw new HttpsError('invalid-argument', 'txId is required for delete.');
  }

  const auditLogId = makeId('audit');
  const buildingRef = db.doc(`buildings/${buildingId}`);
  const txRef = db.doc(`buildings/${buildingId}/transactions/${txId}`);
  const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

  return db.runTransaction(async (tx) => {
    // === PHASE 1: ALL READS FIRST ===
    const buildingSnap = await tx.get(buildingRef);
    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const oldTxSnap = await tx.get(txRef);
    if (!oldTxSnap.exists) {
      throw new HttpsError('not-found', `Transaction "${txId}" not found.`);
    }

    const oldTx = oldTxSnap.data();
    const unitRef = oldTx.unitId ? db.doc(`buildings/${buildingId}/units/${oldTx.unitId}`) : null;
    const unitSnap = unitRef ? await tx.get(unitRef) : null;
    const monthRef = db.doc(`buildings/${buildingId}/monthlySummaries/${oldTx.yearMonth}`);
    const monthSnap = await tx.get(monthRef);

    // === PHASE 2: PURE REVERSAL MATH ===
    const nowTs = fieldValue.serverTimestamp();
    const buildingData = buildingSnap.data();
    const oldImpacts = computeTxImpacts(oldTx);

    let nextUnitBalances = null;
    const unitTransitions = [];
    if (unitSnap?.exists) {
      const beforeBal = unitSnap.data().balances || {};
      nextUnitBalances = applyUnitBalanceDelta(
        beforeBal,
        oldTx.fund,
        -oldImpacts.signedUnitDeltaHuf,
        -oldImpacts.requiredDelta,
        -oldImpacts.paidDelta
      );
      unitTransitions.push({ before: beforeBal, after: nextUnitBalances });
    }

    const nextBuildingBalances = applyBuildingBankDelta(
      buildingData.balances || {},
      oldTx.fund,
      -oldImpacts.signedBankDeltaHuf
    );

    const nextAggregates = applyAggregatesTransitions(
      buildingData.aggregates || {},
      unitTransitions
    );
    const arrearsDeltaHuf =
      nextAggregates.totalArrearsHuf - Math.round(Number(buildingData.aggregates?.totalArrearsHuf) || 0);

    const nextMonth = applyMonthlySummaryDelta(
      monthSnap.exists ? monthSnap.data() : null,
      oldTx.yearMonth,
      oldTx.fund,
      -oldImpacts.monthlyInflowDelta,
      -oldImpacts.monthlyOutflowDelta
    );

    const auditDoc = {
      id: auditLogId,
      buildingId,
      action: 'tx.delete',
      entityType: 'transaction',
      entityId: txId,
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: actor.role,
      timestamp: nowTs,
      summary: `Deleted ${oldTx.kind} ${oldTx.amountHuf} HUF (${oldTx.fund})${reason ? ` — ${String(reason).slice(0, 200)}` : ''}`,
      before: oldTx,
      after: null,
      deltas: {
        unitId: oldTx.unitId || null,
        fund: oldTx.fund,
        unitBalanceDeltaHuf: -oldImpacts.signedUnitDeltaHuf,
        bankBalanceDeltaHuf: -oldImpacts.signedBankDeltaHuf,
        buildingArrearsDeltaHuf: arrearsDeltaHuf,
      },
    };

    // === PHASE 3: ALL WRITES ATOMICALLY ===
    tx.delete(txRef);

    if (unitRef && nextUnitBalances) {
      tx.update(unitRef, {
        balances: nextUnitBalances,
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });
    }

    tx.update(buildingRef, {
      balances: nextBuildingBalances,
      aggregates: {
        ...nextAggregates,
        lastRecalculatedAt: nowTs,
      },
      updatedAt: nowTs,
      lastAuditLogId: auditLogId,
    });

    if (monthSnap.exists) {
      tx.set(monthRef, { ...nextMonth, updatedAt: nowTs }, { merge: true });
    }

    tx.set(auditRef, auditDoc);

    return {
      success: true,
      txId,
      auditLogId,
      buildingBalances: nextBuildingBalances,
      buildingAggregates: nextAggregates,
    };
  });
}

/**
 * Pure core transaction: CALIBRATE building bank balances (adjusting initialReserves atomically).
 */
export async function executeCalibrateBalances(db, fieldValue, buildingId, payload, actor) {
  const auditLogId = makeId('audit');
  const buildingRef = db.doc(`buildings/${buildingId}`);
  const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

  return db.runTransaction(async (tx) => {
    const buildingSnap = await tx.get(buildingRef);
    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const nowTs = fieldValue.serverTimestamp();
    const bData = buildingSnap.data();
    const oldBalances = bData.balances || { KK: 0, FA: 0, custom: {} };
    const oldInit = bData.initialReserves || { KK: 0, FA: 0, custom: {} };

    const targetKK = payload.targetKK !== undefined ? Math.round(Number(payload.targetKK) || 0) : oldBalances.KK;
    const targetFA = payload.targetFA !== undefined ? Math.round(Number(payload.targetFA) || 0) : oldBalances.FA;

    // Delta between desired live balance and current live balance shifts initialReserve by exact same delta
    const deltaKK = targetKK - (Number(oldBalances.KK) || 0);
    const deltaFA = targetFA - (Number(oldBalances.FA) || 0);

    const nextCustomBalances = { ...(oldBalances.custom || {}) };
    const nextCustomInit = { ...(oldInit.custom || {}) };

    if (payload.customTargets && typeof payload.customTargets === 'object') {
      for (const [accId, rawTarget] of Object.entries(payload.customTargets)) {
        const cleanId = normalizeFundKey(accId);
        const tgt = Math.round(Number(rawTarget) || 0);
        const cur = Math.round(Number(nextCustomBalances[cleanId]) || 0);
        nextCustomBalances[cleanId] = tgt;
        nextCustomInit[cleanId] = Math.round(Number(nextCustomInit[cleanId]) || 0) + (tgt - cur);
      }
    }

    const customSum = Object.values(nextCustomBalances).reduce((s, v) => s + (Number(v) || 0), 0);
    const nextBalances = {
      KK: targetKK,
      FA: targetFA,
      custom: nextCustomBalances,
      totalReserve: targetKK + targetFA + customSum,
    };

    const nextInitialReserves = {
      KK: (Number(oldInit.KK) || 0) + deltaKK,
      FA: (Number(oldInit.FA) || 0) + deltaFA,
      custom: nextCustomInit,
    };

    const auditDoc = {
      id: auditLogId,
      buildingId,
      action: 'balance.calibrate',
      entityType: 'building',
      entityId: buildingId,
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: actor.role,
      timestamp: nowTs,
      summary: `Calibrated bank balances: KK=${targetKK} HUF, FA=${targetFA} HUF`,
      before: { balances: oldBalances, initialReserves: oldInit },
      after: { balances: nextBalances, initialReserves: nextInitialReserves },
      deltas: {
        bankBalanceDeltaHuf: nextBalances.totalReserve - (Number(oldBalances.totalReserve) || 0),
      },
    };

    tx.update(buildingRef, {
      balances: nextBalances,
      initialReserves: nextInitialReserves,
      updatedAt: nowTs,
      lastAuditLogId: auditLogId,
    });
    tx.set(auditRef, auditDoc);

    return {
      success: true,
      auditLogId,
      balances: nextBalances,
      initialReserves: nextInitialReserves,
    };
  });
}

// =============================================================================
// EXPORTED CLOUD FUNCTIONS v2 (europe-west1)
// =============================================================================

export const mutateTransaction = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { action, buildingId, txId, payload, reason } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    try {
      if (action === 'create') {
        return await executeCreateTransaction(db, FieldValue, buildingId, payload, actor);
      }
      if (action === 'update') {
        return await executeUpdateTransaction(db, FieldValue, buildingId, txId, payload, actor);
      }
      if (action === 'delete') {
        return await executeDeleteTransaction(db, FieldValue, buildingId, txId, reason, actor);
      }
      throw new HttpsError('invalid-argument', `Unsupported action: ${action}`);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('invalid-argument', err.message || 'Transaction mutation failed.');
    }
  }
);

export const calibrateBuildingBalances = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { buildingId, targetKK, targetFA, customTargets } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    return executeCalibrateBalances(
      db,
      FieldValue,
      buildingId,
      { targetKK, targetFA, customTargets },
      actor
    );
  }
);
