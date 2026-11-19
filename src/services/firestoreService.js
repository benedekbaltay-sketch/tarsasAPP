/**
 * Multi-Tenant Cloud Firestore, Cloud Functions & Cloud Storage Client Service
 *
 * Enforces Tht./GDPR-scoped queries matching `firestore.rules` ("rules are not filters"),
 * server-side pagination (50 items/page), Option A Cloud Function atomic financial mutations,
 * and Cloud Storage binary attachment handling (zero Base64 blobs in Firestore).
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { getFirebaseInstance } from '../constants/firebaseConfig.js';

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

function requireStorage() {
  const { storage } = getFirebaseInstance();
  if (!storage) throw new Error('Firebase Storage is not initialized.');
  return storage;
}

/**
 * Recursively removes `undefined` properties before writing to Firestore.
 */
function stripUndefinedDeep(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item));
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      out[k] = stripUndefinedDeep(v);
    }
  }
  return out;
}

// =============================================================================
// 1. USER, MEMBERSHIP & BUILDING READS / METADATA WRITES
// =============================================================================

export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserPreferences(uid, updates = {}) {
  if (!uid) return;
  const db = requireFirestore();
  const allowed = {};
  if (updates.preferredLang !== undefined) allowed.preferredLang = updates.preferredLang === 'en' ? 'en' : 'hu';
  if (updates.globalSettings !== undefined) allowed.globalSettings = stripUndefinedDeep(updates.globalSettings);
  if (updates.repProfile !== undefined) allowed.repProfile = stripUndefinedDeep(updates.repProfile);
  if (updates.phone !== undefined) allowed.phone = String(updates.phone || '').slice(0, 40);
  if (Object.keys(allowed).length === 0) return;

  await updateDoc(doc(db, 'users', uid), {
    ...allowed,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchBuildingMember(buildingId, uid) {
  if (!buildingId || !uid) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'buildings', buildingId, 'members', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchBuildingMembers(buildingId, role) {
  if (!buildingId || (role !== 'admin' && role !== 'superadmin')) return [];
  const db = requireFirestore();
  const snap = await getDocs(collection(db, 'buildings', buildingId, 'members'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchBuildingRoot(buildingId) {
  if (!buildingId) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'buildings', buildingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAllBuildingsForSuperAdmin() {
  const db = requireFirestore();
  const snap = await getDocs(collection(db, 'buildings'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Updates non-financial metadata on buildings/{buildingId}.
 * Strictly strips server-protected financial fields & banking API secrets to comply with firestore.rules.
 */
export async function updateBuildingMetadata(buildingId, rawUpdates = {}) {
  if (!buildingId) return;
  const db = requireFirestore();
  const {
    balances,
    aggregates,
    initialReserves,
    ...safe
  } = rawUpdates || {};

  if (safe.bankApi && typeof safe.bankApi === 'object') {
    const { apiKey, clientSecret, secretKey, ...safeBankApi } = safe.bankApi;
    safe.bankApi = safeBankApi;
  }

  const cleaned = stripUndefinedDeep(safe);
  await updateDoc(doc(db, 'buildings', buildingId), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchBuildingCategories(buildingId) {
  const db = requireFirestore();
  const snap = await getDocs(
    query(collection(db, 'buildings', buildingId, 'categories'), orderBy('sortOrder', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchMonthlySummaries(buildingId, maxMonths = 24) {
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
// 2. GDPR-SCOPED UNIT & LOAN READS / METADATA WRITES
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

/**
 * Admin master-data update on units/{unitId}.
 * Strictly strips server-protected balances, ownerUids, activeLoanShares & legacy secret fields.
 */
export async function updateUnitMasterData(buildingId, unitId, rawUpdates = {}) {
  if (!buildingId || !unitId) return;
  const db = requireFirestore();
  const {
    balances,
    ownerUids,
    activeLoanShares,
    pass,
    password,
    resetToken,
    resetTokenExpiry,
    ...safe
  } = rawUpdates || {};

  const cleaned = stripUndefinedDeep(safe);
  await updateDoc(doc(db, 'buildings', buildingId, 'units', unitId), {
    ...cleaned,
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
// 4. DOCUMENTS, INFO SECTIONS & CALENDAR EVENTS (GDPR-SCOPED)
// =============================================================================

export async function fetchBuildingDocuments(buildingId, role) {
  const db = requireFirestore();
  const colRef = collection(db, 'buildings', buildingId, 'documents');
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb';
  const q = isPrivileged ? colRef : query(colRef, where('visibility', '==', 'building'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveBuildingDocument(buildingId, docId, docData) {
  const db = requireFirestore();
  const { fileData, ...metadataOnly } = docData || {};
  await setDoc(
    doc(db, 'buildings', buildingId, 'documents', docId),
    {
      ...stripUndefinedDeep(metadataOnly),
      id: docId,
      buildingId,
      visibility: metadataOnly.visibility === 'admin' ? 'admin' : 'building',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteBuildingDocument(buildingId, docId) {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'buildings', buildingId, 'documents', docId));
}

export async function fetchBuildingInfoSections(buildingId, role) {
  const db = requireFirestore();
  const colRef = collection(db, 'buildings', buildingId, 'infoSections');
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb';
  const q = isPrivileged ? colRef : query(colRef, where('visibility', '==', 'building'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveBuildingInfoSection(buildingId, sectionId, sectionData) {
  const db = requireFirestore();
  await setDoc(
    doc(db, 'buildings', buildingId, 'infoSections', sectionId),
    {
      ...stripUndefinedDeep(sectionData),
      id: sectionId,
      buildingId,
      visibility: sectionData?.visibility === 'admin' ? 'admin' : 'building',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteBuildingInfoSection(buildingId, sectionId) {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'buildings', buildingId, 'infoSections', sectionId));
}

export async function fetchBuildingCalendarEvents(buildingId, role) {
  const db = requireFirestore();
  const colRef = collection(db, 'buildings', buildingId, 'calendarEvents');
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb';
  const q = isPrivileged ? colRef : query(colRef, where('visibility', '==', 'building'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveBuildingCalendarEvent(buildingId, eventId, eventData) {
  const db = requireFirestore();
  await setDoc(
    doc(db, 'buildings', buildingId, 'calendarEvents', eventId),
    {
      ...stripUndefinedDeep(eventData),
      id: eventId,
      buildingId,
      visibility: eventData?.visibility === 'admin' ? 'admin' : 'building',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteBuildingCalendarEvent(buildingId, eventId) {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'buildings', buildingId, 'calendarEvents', eventId));
}

// =============================================================================
// 5. IMMUTABLE AUDIT LOGS VIEWER (Admin & SZVB ONLY)
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
// 6. OPTION A — ATOMIC CLOUD FUNCTIONS CALLABLES
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
// 7. CLOUD STORAGE UPLOAD & SECURE DOWNLOAD HELPERS
// =============================================================================

function decodeBase64DataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid Base64 data URL.');
  const mimeType = match[1];
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { mimeType, bytes };
}

export async function uploadBase64ToStorage(storagePath, dataUrl, fallbackMimeType = 'application/octet-stream') {
  if (!storagePath || !dataUrl) return null;
  const storage = requireStorage();
  const { mimeType, bytes } = decodeBase64DataUrl(dataUrl);
  const contentType = mimeType || fallbackMimeType;
  const objRef = storageRef(storage, storagePath);
  await uploadBytes(objRef, bytes, { contentType });
  return {
    storagePath,
    mimeType: contentType,
    sizeBytes: bytes.length,
  };
}

export async function deleteFromStorage(storagePath) {
  if (!storagePath) return;
  try {
    const storage = requireStorage();
    await deleteObject(storageRef(storage, storagePath));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('Cloud Storage delete warning:', err?.message);
    }
  }
}

export async function getSecureStorageDownloadUrl(storagePath) {
  if (!storagePath) return null;
  const storage = requireStorage();
  return getDownloadURL(storageRef(storage, storagePath));
}
