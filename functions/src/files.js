/**
 * Server-Side RBAC-Verified Cloud Storage Download & Upload Cloud Functions (v2, europe-west1)
 *
 * Guarantees strict Tht./GDPR authorization directly against Cloud Firestore memberships
 * (immune to cross-service Storage Rules IAM edge cases) while keeping the raw Storage
 * bucket strictly locked down (zero public download tokens leaked).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const REGION = 'europe-west1';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'tarsashaz-cfe5d.firebasestorage.app';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/msword',
]);

/**
 * Parses and strictly validates a canonical multi-tenant building storage path:
 *   buildings/{buildingId}/{category}/{entityId}/{fileName...}
 */
function parseBuildingStoragePath(rawPath) {
  const clean = String(rawPath || '').trim().replace(/^\/+/, '');
  if (!clean || clean.includes('..') || clean.includes('\\')) {
    throw new HttpsError('invalid-argument', 'Invalid storage path.');
  }
  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 5 || parts[0] !== 'buildings') {
    throw new HttpsError('invalid-argument', 'Storage path must follow buildings/{buildingId}/{category}/{entityId}/{fileName}.');
  }
  const [, buildingId, category, entityId, ...rest] = parts;
  const fileName = rest.join('/');
  return { clean, buildingId, category, entityId, fileName };
}

async function resolveBuildingAccess(db, auth, buildingId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  const isSuperAdmin = auth.token?.superadmin === true;
  if (isSuperAdmin) {
    return { isSuperAdmin: true, active: true, role: 'superadmin', staffBuildingRole: null, unitIds: [] };
  }
  const snap = await db.doc(`buildings/${buildingId}/members/${auth.uid}`).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'You do not have access to this building.');
  }
  const data = snap.data() || {};
  if (data.active !== true) {
    throw new HttpsError('permission-denied', 'Your building membership is inactive.');
  }
  return {
    isSuperAdmin: false,
    active: true,
    role: String(data.role || 'owner').toLowerCase(),
    staffBuildingRole: data.staffBuildingRole || null,
    unitIds: Array.isArray(data.unitIds) ? data.unitIds : [],
  };
}

function isPrivilegedReader(access) {
  return (
    access.isSuperAdmin ||
    access.role === 'admin' ||
    access.role === 'szvb' ||
    access.role === 'auditor'
  );
}

function isWriteAdmin(access) {
  return (
    access.isSuperAdmin ||
    (access.role === 'admin' && access.staffBuildingRole !== 'viewer')
  );
}

/**
 * RBAC-verified file download from Cloud Storage.
 * Returns Base64 payload + contentType so the client constructs a same-origin blob: URL
 * for both direct file download and CSP-safe in-app preview.
 */
export const downloadBuildingFile = onCall(
  { region: REGION, memory: '512MiB', maxInstances: 20, invoker: 'public' },
  async (request) => {
    const db = getFirestore();
    const { storagePath } = request.data || {};
    const { clean, buildingId, category, entityId, fileName } = parseBuildingStoragePath(storagePath);
    const access = await resolveBuildingAccess(db, request.auth, buildingId);

    if (category === 'documents') {
      if (!isPrivilegedReader(access)) {
        const docSnap = await db.doc(`buildings/${buildingId}/documents/${entityId}`).get();
        if (!docSnap.exists || docSnap.data()?.visibility !== 'building') {
          throw new HttpsError('permission-denied', 'You do not have permission to access this document.');
        }
      }
    } else if (category === 'attachments') {
      if (!isPrivilegedReader(access)) {
        const txSnap = await db.doc(`buildings/${buildingId}/transactions/${entityId}`).get();
        const tx = txSnap.exists ? txSnap.data() : null;
        const allowed =
          tx &&
          (tx.visibility === 'building' || (tx.unitId && access.unitIds.includes(tx.unitId)));
        if (!allowed) {
          throw new HttpsError('permission-denied', 'You do not have permission to access this attachment.');
        }
      }
    } else if (category === 'infoAttachments') {
      if (!isPrivilegedReader(access)) {
        const secSnap = await db.doc(`buildings/${buildingId}/infoSections/${entityId}`).get();
        if (!secSnap.exists || secSnap.data()?.visibility !== 'building') {
          throw new HttpsError('permission-denied', 'You do not have permission to access this attachment.');
        }
      }
    } else if (category === 'auditOpinions' || category === 'mail') {
      // Any active building member (already verified by resolveBuildingAccess) may read
    } else {
      throw new HttpsError('permission-denied', 'Unsupported file category.');
    }

    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const file = bucket.file(clean);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'File not found in Cloud Storage.');
    }

    const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    const contentType = metadata?.contentType || 'application/octet-stream';

    return {
      success: true,
      fileName,
      contentType,
      sizeBytes: buffer.length,
      base64: buffer.toString('base64'),
    };
  }
);

/**
 * RBAC-verified file upload to Cloud Storage.
 * Strictly validates caller write permissions, MIME allowlist, and 10 MB ceiling server-side.
 */
export const uploadBuildingFile = onCall(
  { region: REGION, memory: '512MiB', maxInstances: 20, invoker: 'public' },
  async (request) => {
    const db = getFirestore();
    const { storagePath, base64, contentType } = request.data || {};
    const { clean, buildingId, category } = parseBuildingStoragePath(storagePath);
    const access = await resolveBuildingAccess(db, request.auth, buildingId);

    if (category === 'documents' || category === 'attachments' || category === 'infoAttachments') {
      if (!isWriteAdmin(access)) {
        throw new HttpsError('permission-denied', 'Building admin write permission is required to upload files.');
      }
    } else if (category === 'auditOpinions') {
      if (!isWriteAdmin(access) && access.role !== 'auditor') {
        throw new HttpsError('permission-denied', 'Economic Auditor or Admin permission is required.');
      }
    } else if (category === 'mail') {
      // Any active building member may attach files to direct mail
    } else {
      throw new HttpsError('permission-denied', 'Unsupported upload category.');
    }

    const cleanMime = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      throw new HttpsError('invalid-argument', `Unsupported MIME type: ${cleanMime || 'unknown'}`);
    }

    if (typeof base64 !== 'string' || !base64.trim()) {
      throw new HttpsError('invalid-argument', 'File content is required.');
    }
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length <= 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new HttpsError('invalid-argument', 'File size must be between 1 byte and 10 MB.');
    }

    const bucket = getStorage().bucket(STORAGE_BUCKET);
    await bucket.file(clean).save(buffer, {
      contentType: cleanMime,
      resumable: false,
      metadata: {
        contentType: cleanMime,
        metadata: {
          uploadedByUid: request.auth.uid,
        },
      },
    });

    return {
      success: true,
      storagePath: clean,
      mimeType: cleanMime,
      sizeBytes: buffer.length,
    };
  }
);
