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
  onSnapshot,
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
  getBlob,
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

export async function fetchUserNotifications(uid, maxCount = 200) {
  if (!uid) return [];
  const db = requireFirestore();
  const snap = await getDocs(
    query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    )
  );
  return snap.docs.map((d) => {
    const data = d.data() || {};
    const createdIso =
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
    return { id: d.id, ...data, createdAt: createdIso };
  });
}

export async function updateUserNotification(uid, notifId, patch = {}) {
  if (!uid || !notifId) return;
  const db = requireFirestore();
  const allowedKeys = ['read', 'readAt', 'dismissed', 'archived', 'archivedAt', 'archivedUpdatedAt', 'deleted', 'deletedAt'];
  const clean = {};
  for (const k of allowedKeys) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (Object.keys(clean).length === 0) return;
  await updateDoc(doc(db, 'users', uid, 'notifications', notifId), clean);
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
    szvb,
    economicAuditor,
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

  if (role === 'admin' || role === 'superadmin' || role === 'szvb' || role === 'auditor') {
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
 * Loans collection is strictly Admin, SZVB & Economic Auditor ONLY (Regular Owners see their own slice inside units/{unitId}.activeLoanShares).
 */
export async function fetchScopedLoans(buildingId, role) {
  if (role !== 'admin' && role !== 'superadmin' && role !== 'szvb' && role !== 'auditor') {
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

  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb' || role === 'auditor';

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
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb' || role === 'auditor';
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
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb' || role === 'auditor';
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
  const isPrivileged = role === 'admin' || role === 'superadmin' || role === 'szvb' || role === 'auditor';
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

export async function fetchOrganization(orgId) {
  if (!orgId) return null;
  const db = requireFirestore();
  const snap = await getDoc(doc(db, 'organizations', orgId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateOrganizationMetadata(orgId, updates = {}) {
  if (!orgId) return;
  const db = requireFirestore();
  const allowed = {};
  if (updates.name !== undefined) allowed.name = String(updates.name || '').trim();
  if (updates.taxNumber !== undefined) allowed.taxNumber = String(updates.taxNumber || '').trim();
  if (updates.centralContact !== undefined) allowed.centralContact = stripUndefinedDeep(updates.centralContact);
  if (updates.showCentralContactToResidents !== undefined) {
    allowed.showCentralContactToResidents = Boolean(updates.showCentralContactToResidents);
  }
  if (Object.keys(allowed).length === 0) return;
  await updateDoc(doc(db, 'organizations', orgId), {
    ...allowed,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeUserNotifications(uid, onUpdate) {
  if (!uid || typeof onUpdate !== 'function') return () => {};
  const db = requireFirestore();
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() || {};
        const createdIso =
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
        return { id: d.id, ...data, createdAt: createdIso };
      });
      onUpdate(items);
    },
    (err) => console.warn('Firestore notifications listener warning:', err?.message)
  );
}

export function subscribeOrganization(orgId, onUpdate) {
  if (!orgId || typeof onUpdate !== 'function') return () => {};
  const db = requireFirestore();
  return onSnapshot(
    doc(db, 'organizations', orgId),
    (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...snap.data() });
      }
    },
    (err) => console.warn('Firestore organization listener warning:', err?.message)
  );
}

export async function callManageOrganizationMember(payload) {
  const fn = httpsCallable(requireFunctions(), 'manageOrganizationMember');
  const res = await fn(payload);
  return res.data;
}

export async function fetchBuildingEmailRules(buildingId) {
  if (!buildingId) return [];
  const db = requireFirestore();
  const snap = await getDocs(collection(db, 'buildings', buildingId, 'emailRules'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveBuildingEmailRule(buildingId, ruleId, ruleData) {
  if (!buildingId || !ruleId) return;
  const db = requireFirestore();
  await setDoc(
    doc(db, 'buildings', buildingId, 'emailRules', ruleId),
    {
      ...stripUndefinedDeep(ruleData),
      id: ruleId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteBuildingEmailRule(buildingId, ruleId) {
  if (!buildingId || !ruleId) return;
  const db = requireFirestore();
  await deleteDoc(doc(db, 'buildings', buildingId, 'emailRules', ruleId));
}

export async function fetchBuildingEmailOutbox(buildingId, maxCount = 200) {
  if (!buildingId) return [];
  const db = requireFirestore();
  const snap = await getDocs(
    query(collection(db, 'buildings', buildingId, 'emailOutbox'), limit(maxCount))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.queuedAt || '').localeCompare(String(a.queuedAt || '')));
}

export async function saveBuildingEmailOutboxItem(buildingId, itemId, itemData) {
  if (!buildingId || !itemId) return;
  const db = requireFirestore();
  await setDoc(
    doc(db, 'buildings', buildingId, 'emailOutbox', itemId),
    {
      ...stripUndefinedDeep(itemData),
      id: itemId,
    },
    { merge: true }
  );
}

export async function clearBuildingEmailOutbox(buildingId) {
  if (!buildingId) return;
  const db = requireFirestore();
  const snap = await getDocs(collection(db, 'buildings', buildingId, 'emailOutbox'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
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

export async function callManageSzvbMembers({ buildingId, chairperson = null, members = [] }) {
  const fn = httpsCallable(requireFunctions(), 'manageSzvbMembers');
  const res = await fn({ buildingId, chairperson, members });
  return res.data;
}

export async function callManageEconomicAuditor({ buildingId, auditor = {} }) {
  const fn = httpsCallable(requireFunctions(), 'manageEconomicAuditor');
  const res = await fn({ buildingId, auditor });
  return res.data;
}

export async function callSendDirectMail(payload) {
  const fn = httpsCallable(requireFunctions(), 'sendDirectMail');
  const res = await fn(payload);
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
  const base64 = match[2];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { mimeType, base64, bytes };
}

export async function uploadBase64ToStorage(storagePath, dataUrl, fallbackMimeType = 'application/octet-stream') {
  if (!storagePath || !dataUrl) return null;
  const { mimeType, base64, bytes } = decodeBase64DataUrl(dataUrl);
  const contentType = mimeType || fallbackMimeType;
  try {
    const fn = httpsCallable(requireFunctions(), 'uploadBuildingFile');
    const res = await fn({ storagePath, base64, contentType });
    if (res?.data?.success) {
      return {
        storagePath: res.data.storagePath || storagePath,
        mimeType: res.data.mimeType || contentType,
        sizeBytes: res.data.sizeBytes || bytes.length,
      };
    }
  } catch (fnErr) {
    console.warn('uploadBuildingFile callable fallback to direct Storage SDK:', fnErr?.code || fnErr?.message);
  }
  const storage = requireStorage();
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
  // Primary path: RBAC-verified Cloud Function returns Base64 -> same-origin blob: URL
  // (works cleanly for ALL roles without cross-service Storage Rules 403 or CORS issues).
  try {
    const fn = httpsCallable(requireFunctions(), 'downloadBuildingFile');
    const res = await fn({ storagePath });
    const data = res?.data;
    if (data?.success && typeof data.base64 === 'string') {
      const binaryStr = atob(data.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.contentType || 'application/octet-stream' });
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(blob);
      }
      return `data:${data.contentType || 'application/octet-stream'};base64,${data.base64}`;
    }
  } catch (fnErr) {
    console.warn('downloadBuildingFile callable fallback:', fnErr?.code || fnErr?.message);
  }

  // Fallback: direct Storage SDK getBlob / getDownloadURL (works for SuperAdmin / emulators)
  const storage = requireStorage();
  const refObj = storageRef(storage, storagePath);
  try {
    const blob = await getBlob(refObj);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(blob);
    }
  } catch (blobErr) {
    console.warn('Cloud Storage getBlob fallback to downloadURL:', blobErr?.code || blobErr?.message);
  }
  return getDownloadURL(refObj);
}
