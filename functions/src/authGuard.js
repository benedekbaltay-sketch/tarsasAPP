/**
 * Server-Side RBAC Verification Guards for Cloud Functions v2
 */

import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Verifies the caller is authenticated and is either a SuperAdmin
 * or an active 'admin' member of the specified buildingId.
 */
export async function assertBuildingAdmin(db, auth, buildingId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  if (!buildingId || typeof buildingId !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid buildingId is required.');
  }

  const email = String(auth.token?.email || '').toLowerCase().trim();

  if (auth.token?.superadmin === true) {
    return {
      uid: auth.uid,
      email,
      role: 'superadmin',
    };
  }

  const memberSnap = await db
    .doc(`buildings/${buildingId}/members/${auth.uid}`)
    .get();

  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'You do not have access to this building.');
  }

  const member = memberSnap.data();
  if (member?.active !== true || member?.role !== 'admin' || member?.staffBuildingRole === 'viewer') {
    throw new HttpsError('permission-denied', 'Building Common Representative (admin) write role is required.');
  }

  return {
    uid: auth.uid,
    email: email || member.email || '',
    role: 'admin',
  };
}

/**
 * Verifies the caller is authenticated and holds the superadmin Custom Claim.
 */
export function assertSuperAdmin(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  if (auth.token?.superadmin !== true) {
    throw new HttpsError('permission-denied', 'SuperAdmin privileges are required.');
  }
  return {
    uid: auth.uid,
    email: String(auth.token?.email || '').toLowerCase().trim(),
    role: 'superadmin',
  };
}
