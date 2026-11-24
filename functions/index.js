/**
 * TarsasApp Cloud Functions v2 Entrypoint (europe-west1)
 *
 * All financial mutations, monthly assessments, loan syncs, and RBAC membership grants
 * execute strictly server-side inside atomic Cloud Firestore transactions with immutable audit logs.
 */

import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp();
}

export { mutateTransaction, calibrateBuildingBalances } from './src/transactions.js';
export { scheduledMonthlyAssessments, triggerMonthlyAssessments } from './src/assessments.js';
export { scheduledDailyDunningEmails, sendTransactionalEmail } from './src/dunning.js';
export { provisionBuilding, manageBuildingMember, manageUnitLifecycle } from './src/members.js';
export { mutateLoan } from './src/loans.js';
export {
  manageOrganizationMember,
  acceptOrganizationInvite,
  notifyBankAccountChange,
} from './src/organizations.js';
