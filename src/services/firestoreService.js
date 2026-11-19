/**
 * Multi-Tenant Cloud Firestore & Cloud Functions Client Service
 *
 * Enforces Tht./GDPR-scoped queries matching `firestore.rules` ("rules are not filters"),
 * server-side pagination (50 items/page), and Option A Cloud Function atomic financial mutations.
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { getFirebaseInstance } from '../constants/firebaseConfig';

function requireFirestore() {
  const { db } = getFirebaseInstance();
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  return db;
}

function requireFunctions() {
  const { functions } = getFirebaseInstance();
  if (!functions) throw new Error('Cloud Functions SDK is not initialized.');
  return functions;
}

// =============================================================================
// 1. USER, MEMBERSHIP & BUILDING READS
// =============================================================================

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBuildingMember(buildingId, uid) {
  if (!buildingId || !uid) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'buildings', buildingId, 'members', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBuildingRoot(buildingId) {
  if (!buildingId) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'buildings', buildingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBuildingCategories(buildingId) {
  const db = requireFirestore();
  const snap = await getDocs(
    query(collection(db, 'buildings', buildingId, 'categories'), orderBy('sortOrder', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonthlySummaries(buildingId, maxMonths = 12) {
  const db = requireFirestore();
  const snap = await getDocs(
    query(
      collection(db, 'buildings', buildingId, 'monthlySummaries'),
      orderBy('yearMonth', 'desc'),
      limit(maxMonths)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// =============================================================================
// 2. GDPR-SCOPED UNIT & LOAN READS
// =============================================================================

/**
 * Admin & SZVB read all units in the building.
 * Regular Owners strictly query ONLY their own units via `ownerUids array-contains uid`.
 */
export async function fetchScopedUnits(buildingId, role, uid) {
  const db = requireFirestore();
  const unitsCol = collection(db, 'buildings', buildingId, 'units');

  if (role === 'admin' || role === 'superadmin' || role === 'szvb') {
    const snap = await getDocs(query(unitsCol, orderBy('unitCode', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (!uid) return [];
  const snap = await getDocs(
    query(unitsCol, where('ownerUids', 'array-contains', uid), orderBy('unitCode', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Loans collection is strictly Admin & SZVB ONLY (Regular Owners see their own slice inside units/{unitId}.activeLoanShares).
 */
export async function fetchScopedLoans(buildingId, role) {
  if (role !== 'admin' && role !== 'superadmin' && role !== 'szvb') {
    return [];
  }
  const db = requireFirestore();
  const snap = await getDocs(collection(db, 'buildings', buildingId, 'loans'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Allowlisted personal contact update for Regular Owners on their OWN unit.
 */
export async function updateOwnerUnitContact(buildingId, unitId, { phone, emergencyContact, notes }) {
  const db = requireFirestore();
  await updateDoc(doc(db, 'buildings', buildingId, 'units', unitId), {
    phone: String(phone || '').slice(0, 40),
    emergencyContact: String(emergencyContact || '').slice(0, 200),
    notes: String(notes || '').slice(0, 1000),
    updatedAt: serverTimestamp(),
  });
}

// =============================================================================
// 3. SERVER-SIDE PAGINATED & GDPR-SCOPED TRANSACTION QUERIES (50/PAGE)
// =============================================================================

export async function fetchPaginatedTransactions({
  buildingId,
  role,
  unitId = null,
  year = null,
  yearMonth = null,
  visibility = null,
  accessFromDate = null,
  pageSize = 50,
  cursorDoc = null,
}) {
  const db = requireFirestore();
  const txCol = collection(db, 'buildings', buildingId, 'transactions');
  const constraints = [];

  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb';

  if (isPrivileged) {
    if (unitId) {
      constraints.push(where('unitId', '==', unitId));
      if (yearMonth) constraints.push(where('yearMonth', '==', yearMonth));
    } else if (yearMonth) {
      constraints.push(where('yearMonth', '==', yearMonth));
    } else if (year) {
      constraints.push(where('year', '==', Number(year)));
    }
    constraints.push(orderBy('date', 'desc'));
    if (!unitId || !yearMonth) {
      constraints.push(orderBy('createdAt', 'desc'));
    }
  } else {
    // Regular Owner MUST query strictly either:
    //   (a) building-level expenses (`visibility == 'building'`), OR
    //   (b) their OWN unit (`unitId == myUnitId`, optionally bounded by `accessFromDate`)
    if (visibility === 'building' || !unitId) {
      if (yearMonth) {
        constraints.push(where('yearMonth', '==', yearMonth));
        constraints.push(where('visibility', '==', 'building'));
        constraints.push(orderBy('date', 'desc'));
      } else {
        constraints.push(where('visibility', '==', 'building'));
        constraints.push(orderBy('date', 'desc'));
        constraints.push(orderBy('createdAt', 'desc'));
      }
    } else {
      constraints.push(where('unitId', '==', unitId));
      if (accessFromDate) {
        constraints.push(where('date', '>=', accessFromDate));
      }
      constraints.push(orderBy('date', 'desc'));
      constraints.push(orderBy('createdAt', 'desc'));
    }
  }

  if (cursorDoc) {
    constraints.push(startAfter(cursorDoc));
  }
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(txCol, ...constraints));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;

  return {
    items,
    nextCursor,
    hasMore: snap.docs.length === pageSize,
  };
}

// =============================================================================
// 4. IMMUTABLE AUDIT LOGS VIEWER (Admin & SZVB ONLY)
// =============================================================================

export async function fetchPaginatedAuditLogs(buildingId, role, pageSize = 50, cursorDoc = null) {
  if (role !== 'admin' && role !== 'superadmin' && role !== 'szvb') {
    return { items: [], nextCursor: null, hasMore: false };
  }
  const db = requireFirestore();
  const constraints = [orderBy('timestamp', 'desc')];
  if (cursorDoc) constraints.push(startAfter(cursorDoc));
  constraints.push(limit(pageSize));

  const snap = await getDocs(query(collection(db, 'buildings', buildingId, 'auditLogs'), ...constraints));
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

// =============================================================================
// 5. OPTION A — ATOMIC CLOUD FUNCTIONS CALLABLES
// =============================================================================

export async function callMutateTransaction({ action, buildingId, txId = null, payload = null, reason = '' }) {
  const fn = httpsCallable(requireFunctions(), 'mutateTransaction');
  const res = await fn({ action, buildingId, txId, payload, reason });
  return res.data;
}

export async function callCalibrateBuildingBalances({ buildingId, targetKK, targetFA, customTargets = {} }) {
  const fn = httpsCallable(requireFunctions(), 'calibrateBuildingBalances');
  const res = await fn({ buildingId, targetKK, targetFA, customTargets });
  return res.data;
}

export async function callTriggerMonthlyAssessments({ buildingId, yearMonth }) {
  const fn = httpsCallable(requireFunctions(), 'triggerMonthlyAssessments');
  const res = await fn({ buildingId, yearMonth });
  return res.data;
}

export async function callProvisionBuilding(buildingData) {
  const fn = httpsCallable(requireFunctions(), 'provisionBuilding');
  const res = await fn(buildingData);
  return res.data;
}

export async function callManageBuildingMember(memberData) {
  const fn = httpsCallable(requireFunctions(), 'manageBuildingMember');
  const res = await fn(memberData);
  return res.data;
}

export async function callManageUnitLifecycle(unitActionData) {
  const fn = httpsCallable(requireFunctions(), 'manageUnitLifecycle');
  const res = await fn(unitActionData);
  return res.data;
}

export async function callMutateLoan(loanActionData) {
  const fn = httpsCallable(requireFunctions(), 'mutateLoan');
  const res = await fn(loanActionData);
  return res.data;
}

// =============================================================================
// 6. CLOUD STORAGE SECURE DOWNLOAD URL HELPER
// =============================================================================

export async function getSecureStorageDownloadUrl(storagePath) {
  if (!storagePath) return null;
  const { storage } = getFirebaseInstance();
  if (!storage) throw new Error('Firebase Storage is not initialized.');
  return getDownloadURL(storageRef(storage, storagePath));
}
