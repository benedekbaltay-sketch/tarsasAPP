/**
 * Idempotent Monthly Assessment Materializer
 *
 * Materializes monthly recurring Common Cost (KK), Renovation Fund (FA),
 * custom fee-bearing accounts, and financed loan installments as deterministic
 * ledger entries (`assess_${YYYY-MM}_${unitId}_${fund}`) inside atomic transactions,
 * ensuring stored unit balances and building arrears totals never drift.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { assertBuildingAdmin } from './authGuard.js';
import { executeCreateTransaction } from './transactions.js';
import { getEffectiveUnitFeeForMonth, slugifyUnitId } from './financeMath.js';

const MONTH_NAMES_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Generates idempotent monthly assessments for a single building and YYYY-MM period.
 */
export async function executeGenerateMonthlyAssessments(db, fieldValue, buildingId, yearMonth, actor) {
  if (!YEAR_MONTH_RE.test(yearMonth)) {
    throw new Error('yearMonth must match YYYY-MM format.');
  }

  const [yStr, mStr] = yearMonth.split('-');
  const monthIdx = Number(mStr) - 1;
  const monthDateStr = `${yearMonth}-01`;
  const monthLabelHu = `${yStr} ${MONTH_NAMES_HU[monthIdx]}`;

  const buildingSnap = await db.doc(`buildings/${buildingId}`).get();
  if (!buildingSnap.exists) {
    throw new Error(`Building "${buildingId}" not found.`);
  }
  const building = buildingSnap.data();

  const unitsSnap = await db.collection(`buildings/${buildingId}/units`).get();
  const loansSnap = await db.collection(`buildings/${buildingId}/loans`).where('status', '==', 'active').get();
  const activeLoans = loansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const customFeeAccounts = (building.bankAccounts?.custom || []).filter((a) => a && a.hasMonthlyFee);

  let createdCount = 0;
  let skippedCount = 0;

  for (const unitDoc of unitsSnap.docs) {
    const unit = { id: unitDoc.id, ...unitDoc.data() };
    const startKK = unit.fees?.startDateKK || '2026-09-01';
    const startFA = unit.fees?.startDateFA || '2026-06-01';

    // 1. Common Cost (KK) assessment
    if (monthDateStr >= startKK) {
      const amountKK = getEffectiveUnitFeeForMonth(unit, 'KK', monthDateStr);
      if (amountKK > 0) {
        const res = await executeCreateTransaction(
          db,
          fieldValue,
          buildingId,
          {
            id: `assess_${yearMonth}_${unit.id}_KK`,
            kind: 'assessment',
            unitId: unit.id,
            unitCode: unit.unitCode,
            categoryId: 'cat-inc-kk',
            fund: 'KK',
            direction: 'debit',
            amountHuf: amountKK,
            date: monthDateStr,
            paymentMethod: 'system_assessment',
            affectsBankBalance: false,
            includeInFlatBalance: true,
            status: 'verified',
            comment: `Havi előírás - ${monthLabelHu}`,
            source: 'monthly_scheduler',
          },
          actor
        );
        if (res.duplicate) skippedCount++;
        else createdCount++;
      }
    }

    // 2. Renovation Fund (FA) assessment
    if (monthDateStr >= startFA) {
      const amountFA = getEffectiveUnitFeeForMonth(unit, 'FA', monthDateStr);
      if (amountFA > 0) {
        const res = await executeCreateTransaction(
          db,
          fieldValue,
          buildingId,
          {
            id: `assess_${yearMonth}_${unit.id}_FA`,
            kind: 'assessment',
            unitId: unit.id,
            unitCode: unit.unitCode,
            categoryId: 'cat-inc-fa',
            fund: 'FA',
            direction: 'debit',
            amountHuf: amountFA,
            date: monthDateStr,
            paymentMethod: 'system_assessment',
            affectsBankBalance: false,
            includeInFlatBalance: true,
            status: 'verified',
            comment: `Havi előírás - ${monthLabelHu}`,
            source: 'monthly_scheduler',
          },
          actor
        );
        if (res.duplicate) skippedCount++;
        else createdCount++;
      }
    }

    // 3. Custom fee-bearing sub-accounts
    for (const acc of customFeeAccounts) {
      const accStart = unit.fees?.customStartDates?.[acc.id] || startKK;
      if (monthDateStr >= accStart) {
        const amountCustom = getEffectiveUnitFeeForMonth(unit, acc.id, monthDateStr);
        if (amountCustom > 0) {
          const res = await executeCreateTransaction(
            db,
            fieldValue,
            buildingId,
            {
              id: `assess_${yearMonth}_${unit.id}_${acc.id}`,
              kind: 'assessment',
              unitId: unit.id,
              unitCode: unit.unitCode,
              categoryId: 'cat-inc-extra',
              fund: acc.id,
              direction: 'debit',
              amountHuf: amountCustom,
              date: monthDateStr,
              paymentMethod: 'system_assessment',
              affectsBankBalance: false,
              includeInFlatBalance: true,
              status: 'verified',
              comment: `Havi előírás (${acc.name}) - ${monthLabelHu}`,
              source: 'monthly_scheduler',
            },
            actor
          );
          if (res.duplicate) skippedCount++;
          else createdCount++;
        }
      }
    }

    // 4. Financed loan installment assessments (charged under FA)
    for (const loan of activeLoans) {
      const loanStart = loan.startDate ? String(loan.startDate).slice(0, 7) + '-01' : '2024-01-01';
      if (monthDateStr < loanStart) continue;
      if (loan.endDate && monthDateStr > String(loan.endDate).slice(0, 10)) continue;

      const participant = (loan.participants || []).find(
        (p) => p && (p.unitId === unit.id || slugifyUnitId(p.apartmentId) === unit.id)
      );
      if (participant && participant.paymentMethod === 'financed') {
        const installment = Math.round(Number(participant.monthlyContribution) || 0);
        if (installment > 0) {
          const res = await executeCreateTransaction(
            db,
            fieldValue,
            buildingId,
            {
              id: `assess_${yearMonth}_${unit.id}_loan_${loan.id}`,
              kind: 'assessment',
              unitId: unit.id,
              unitCode: unit.unitCode,
              categoryId: 'cat-inc-fa',
              fund: 'FA',
              direction: 'debit',
              amountHuf: installment,
              date: monthDateStr,
              paymentMethod: 'system_assessment',
              affectsBankBalance: false,
              includeInFlatBalance: true,
              status: 'verified',
              loanId: loan.id,
              comment: `${loan.title || 'Hitel'} - Havi törlesztőrészlet (${monthLabelHu})`,
              source: 'monthly_scheduler',
            },
            actor
          );
          if (res.duplicate) skippedCount++;
          else createdCount++;
        }
      }
    }
  }

  return { success: true, buildingId, yearMonth, createdCount, skippedCount };
}

// Scheduled on the 1st of every month at 00:05 Budapest time
export const scheduledMonthlyAssessments = onSchedule(
  {
    schedule: '5 0 1 * *',
    timeZone: 'Europe/Budapest',
    region: 'europe-west1',
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const actor = { uid: 'system:scheduler', email: 'scheduler@tarsasapp.internal', role: 'system' };

    const buildingsSnap = await db.collection('buildings').get();
    for (const bDoc of buildingsSnap.docs) {
      try {
        await executeGenerateMonthlyAssessments(db, FieldValue, bDoc.id, yearMonth, actor);
      } catch (err) {
        console.error(`[scheduledMonthlyAssessments] Failed for building ${bDoc.id}:`, err.message);
      }
    }
  }
);

// On-demand callable for Building Admins (e.g. onboarding catch-up)
export const triggerMonthlyAssessments = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { buildingId, yearMonth } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    try {
      return await executeGenerateMonthlyAssessments(db, FieldValue, buildingId, yearMonth, actor);
    } catch (err) {
      throw new HttpsError('invalid-argument', err.message || 'Failed to generate monthly assessments.');
    }
  }
);
