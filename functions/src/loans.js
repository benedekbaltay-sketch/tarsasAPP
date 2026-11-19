/**
 * Atomic Loan Management & GDPR Owner-Slice Synchronization
 *
 * Full loan contracts & participant lists live strictly in buildings/{bId}/loans/{loanId}
 * (readable by Admin & SZVB ONLY). Whenever a loan is created, updated, deleted, or paid,
 * this Cloud Function atomically updates ONLY each participating unit's own
 * `units/{unitId}.activeLoanShares[]` slice + writes an immutable auditLog entry.
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { assertBuildingAdmin } from './authGuard.js';
import { slugifyUnitId } from './financeMath.js';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function buildOwnerLoanShareSlice(loan, participant) {
  return {
    loanId: loan.id,
    loanTitle: loan.title || '',
    paymentMethod: participant.paymentMethod || 'financed',
    monthlyContributionHuf: Math.round(Number(participant.monthlyContribution) || 0),
    totalShareHuf: Math.round(Number(participant.totalShare || participant.lumpSumAmountPaid) || 0),
    lumpSumAmountPaidHuf: Math.round(Number(participant.lumpSumAmountPaid) || 0),
    status: loan.status || 'active',
  };
}

export const mutateLoan = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { action, buildingId, loanId: rawLoanId, payload, paymentData, paymentId } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);
    const auditLogId = makeId('audit');

    const loanId = rawLoanId ? String(rawLoanId).trim() : makeId('loan');
    const loanRef = db.doc(`buildings/${buildingId}/loans/${loanId}`);
    const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

    await db.runTransaction(async (tx) => {
      const existingSnap = await tx.get(loanRef);
      const existingLoan = existingSnap.exists ? existingSnap.data() : null;

      if (action !== 'create' && !existingLoan) {
        throw new HttpsError('not-found', `Loan "${loanId}" not found.`);
      }

      const nowTs = FieldValue.serverTimestamp();
      let nextLoan = null;
      let auditAction = 'loan.update';

      if (action === 'create') {
        auditAction = 'loan.create';
        const participants = Array.isArray(payload?.participants)
          ? payload.participants.map((p) => ({
              ...p,
              unitId: p.unitId || slugifyUnitId(p.apartmentId),
            }))
          : [];
        const totalProjectCost = Math.round(Number(payload?.totalProjectCost) || 0);
        const lumpSumTotalCollected =
          Math.round(Number(payload?.lumpSumTotalCollected) || 0) ||
          participants.reduce((s, p) => s + (p.paymentMethod === 'lump_sum' ? Math.round(Number(p.lumpSumAmountPaid) || 0) : 0), 0);
        const principalAmount = Math.round(Number(payload?.principalAmount) || Math.max(0, totalProjectCost - lumpSumTotalCollected));

        nextLoan = {
          id: loanId,
          buildingId,
          title: String(payload?.title || '').trim(),
          bankName: String(payload?.bankName || '').trim(),
          contractNumber: String(payload?.contractNumber || '').trim(),
          totalProjectCost,
          lumpSumTotalCollected,
          principalAmount,
          currentBalance: Math.round(Number(payload?.currentBalance ?? principalAmount) || 0),
          termMonths: Math.round(Number(payload?.termMonths) || 12),
          startDate: String(payload?.startDate || new Date().toISOString().slice(0, 10)),
          endDate: String(payload?.endDate || ''),
          monthlyInstallment: Math.round(Number(payload?.monthlyInstallment) || 0),
          interestRatePercent: Number(payload?.interestRatePercent) || 0,
          allocationType: payload?.allocationType || 'ownership_ratio',
          status: payload?.status || 'active',
          participants,
          payments: Array.isArray(payload?.payments) ? payload.payments : [],
          createdAt: nowTs,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        };
      } else if (action === 'update') {
        auditAction = 'loan.update';
        const participants = Array.isArray(payload?.participants)
          ? payload.participants.map((p) => ({ ...p, unitId: p.unitId || slugifyUnitId(p.apartmentId) }))
          : existingLoan.participants || [];
        nextLoan = {
          ...existingLoan,
          ...payload,
          id: loanId,
          buildingId,
          participants,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        };
        if (Number(nextLoan.currentBalance) <= 0 && nextLoan.status === 'active') {
          nextLoan.status = 'paid_off';
        }
      } else if (action === 'recordPayment') {
        auditAction = 'loan.payment_record';
        const principalPaid = Math.round(Number(paymentData?.principalPaid) || 0);
        const interestPaid = Math.round(Number(paymentData?.interestPaid) || 0);
        const bankFee = Math.round(Number(paymentData?.bankFee) || 0);
        const totalPaid = Math.round(Number(paymentData?.totalPaid) || (principalPaid + interestPaid + bankFee));
        const remainingBalanceAfter = Math.max(0, Math.round(Number(existingLoan.currentBalance) || 0) - principalPaid);

        const newPayment = {
          id: paymentData?.id || makeId('lp'),
          paymentDate: String(paymentData?.paymentDate || new Date().toISOString().slice(0, 10)),
          totalPaid,
          principalPaid,
          interestPaid,
          bankFee,
          remainingBalanceAfter,
          status: paymentData?.status || 'completed',
          note: String(paymentData?.note || '').trim(),
        };

        const payments = [newPayment, ...(existingLoan.payments || [])].sort(
          (a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)
        );
        nextLoan = {
          ...existingLoan,
          currentBalance: remainingBalanceAfter,
          status: remainingBalanceAfter <= 0 ? 'paid_off' : existingLoan.status,
          payments,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        };
      } else if (action === 'deletePayment') {
        auditAction = 'loan.update';
        const payments = (existingLoan.payments || []).filter((p) => p.id !== paymentId);
        const totalPrincipalPaid = payments.reduce((s, p) => s + Math.round(Number(p.principalPaid) || 0), 0);
        const newBalance = Math.max(0, Math.round(Number(existingLoan.principalAmount) || 0) - totalPrincipalPaid);
        nextLoan = {
          ...existingLoan,
          currentBalance: newBalance,
          status: newBalance <= 0 ? 'paid_off' : 'active',
          payments,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        };
      } else if (action === 'delete') {
        auditAction = 'loan.delete';
        nextLoan = null;
      } else {
        throw new HttpsError('invalid-argument', `Unsupported loan action: ${action}`);
      }

      // Collect all unitIds touched by either old or new participants
      const prevParticipants = existingLoan?.participants || [];
      const nextParticipants = nextLoan?.participants || [];
      const touchedUnitIds = Array.from(
        new Set([
          ...prevParticipants.map((p) => p.unitId || slugifyUnitId(p.apartmentId)),
          ...nextParticipants.map((p) => p.unitId || slugifyUnitId(p.apartmentId)),
        ].filter(Boolean))
      );

      // Read all touched units BEFORE writes
      const unitSnaps = new Map();
      for (const uId of touchedUnitIds) {
        unitSnaps.set(uId, await tx.get(db.doc(`buildings/${buildingId}/units/${uId}`)));
      }

      // Atomic writes
      if (action === 'delete') {
        tx.delete(loanRef);
      } else {
        tx.set(loanRef, nextLoan);
      }

      // Sync ONLY each unit's own activeLoanShares[] entry (zero cross-unit data!)
      for (const uId of touchedUnitIds) {
        const uSnap = unitSnaps.get(uId);
        if (!uSnap || !uSnap.exists) continue;
        const currentShares = Array.isArray(uSnap.data().activeLoanShares)
          ? uSnap.data().activeLoanShares.filter((s) => s.loanId !== loanId)
          : [];
        if (nextLoan) {
          const matchingParticipant = nextParticipants.find(
            (p) => (p.unitId || slugifyUnitId(p.apartmentId)) === uId
          );
          if (matchingParticipant) {
            currentShares.push(buildOwnerLoanShareSlice(nextLoan, matchingParticipant));
          }
        }
        tx.update(uSnap.ref, {
          activeLoanShares: currentShares,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
      }

      tx.set(auditRef, {
        id: auditLogId,
        buildingId,
        action: auditAction,
        entityType: 'loan',
        entityId: loanId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: `Loan ${action}: "${nextLoan?.title || existingLoan?.title || loanId}"`,
        before: existingLoan,
        after: nextLoan,
      });
    });

    return { success: true, loanId, auditLogId };
  }
);
