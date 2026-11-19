/**
 * TarsasApp Node.js Banking Backend Server (mTLS Gateway)
 *
 * Védett API szerver az OTP Bank Corporate / Open Banking integrációhoz,
 * mTLS szinkronizációhoz és tanúsítványkezeléshez.
 *
 * Biztonsági védelmi rétegek (C-5 / M-6):
 *  - Alapértelmezett loopback binding (127.0.0.1); éles környezetben TLS proxy / Cloud Run mögött fut.
 *  - Szigorú CORS origin allowlist.
 *  - Kétféle hitelesítés a /api/bank/* végpontokon:
 *      1. Szerver-szerver Bearer INTERNAL_API_SECRET (crypto.timingSafeEqual)
 *      2. Opcionális Firebase ID Token + Firestore Admin jogosultság ellenőrzés (FIREBASE_AUTH_ENABLED=true)
 *  - IP-alapú csúszóablakos rate limiting (alapértelmezetten 30 kérés / 60 mp).
 *  - 1 MB kérésméret korlát (HTTP 413) és 15 mp request timeout.
 *  - Strukturált biztonsági audit naplózás ([BANK_AUDIT]) érzékeny adatok maszkolásával.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import {
  validateLocalCertificates,
  sendOtpRequest,
  syncBuildingTransactions,
} from './otpApiClient.js';

const PORT = Number(process.env.PORT) || 5001;
const HOST = process.env.HOST || '127.0.0.1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim();
const FIREBASE_AUTH_ENABLED = String(process.env.FIREBASE_AUTH_ENABLED || '').toLowerCase() === 'true';
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB DoS limit
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;

const DEFAULT_ALLOWED_ORIGINS = IS_PRODUCTION
  ? [
      'https://tarsashaz-cfe5d.web.app',
      'https://tarsashaz-cfe5d.firebaseapp.com',
    ]
  : [
      'https://tarsashaz-cfe5d.web.app',
      'https://tarsashaz-cfe5d.firebaseapp.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

const ALLOWED_ORIGINS = new Set(
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS
);

const INSECURE_PLACEHOLDER_SECRETS = new Set([
  '',
  'dev_internal_secret_change_in_production',
  'changeme',
  'secret',
]);

if (
  IS_PRODUCTION &&
  !FIREBASE_AUTH_ENABLED &&
  (INSECURE_PLACEHOLDER_SECRETS.has(INTERNAL_SECRET) || INTERNAL_SECRET.length < 32)
) {
  console.error(
    '[FATAL] In production, either set INTERNAL_API_SECRET (>= 32 random chars) or enable FIREBASE_AUTH_ENABLED=true.'
  );
  process.exit(1);
}

if (
  !IS_PRODUCTION &&
  !FIREBASE_AUTH_ENABLED &&
  (INSECURE_PLACEHOLDER_SECRETS.has(INTERNAL_SECRET) || INTERNAL_SECRET.length < 16)
) {
  console.warn(
    '[SECURITY WARNING] INTERNAL_API_SECRET is not configured. Protected /api/bank/* endpoints will reject requests until a strong secret is set in .env.'
  );
}

// --- Structured Security Audit Logging (redacts secrets and full IBANs) ---
function maskIban(iban) {
  if (!iban || typeof iban !== 'string' || iban.length < 8) return undefined;
  return `${iban.slice(0, 4)}****${iban.slice(-4)}`;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function auditLog(event) {
  const entry = {
    tag: 'BANK_AUDIT',
    timestamp: new Date().toISOString(),
    ...event,
  };
  console.log(JSON.stringify(entry));
}

// --- In-Memory Sliding-Window Rate Limiter per IP ---
const rateLimitStore = new Map();

function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitStore.get(clientIp) || []).filter((ts) => ts > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    rateLimitStore.set(clientIp, timestamps);
    return { allowed: false, retryAfterSec };
  }

  timestamps.push(now);
  rateLimitStore.set(clientIp, timestamps);

  // Bounded memory cleanup if map grows large
  if (rateLimitStore.size > 5000) {
    for (const [ip, list] of rateLimitStore.entries()) {
      if (list.every((ts) => ts <= windowStart)) {
        rateLimitStore.delete(ip);
      }
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

// --- Optional Lazy Firebase Admin Loader for Direct Admin ID Token Auth ---
let firebaseAdminServicesPromise = null;

async function getFirebaseAdminServices() {
  if (!firebaseAdminServicesPromise) {
    firebaseAdminServicesPromise = (async () => {
      const appMod = await import('firebase-admin/app');
      const authMod = await import('firebase-admin/auth');
      const fsMod = await import('firebase-admin/firestore');
      if (appMod.getApps().length === 0) {
        appMod.initializeApp();
      }
      return {
        auth: authMod.getAuth(),
        db: fsMod.getFirestore(),
      };
    })();
  }
  return firebaseAdminServicesPromise;
}

function isInternalSecretMatch(providedToken) {
  if (INSECURE_PLACEHOLDER_SECRETS.has(INTERNAL_SECRET) || INTERNAL_SECRET.length < 16) {
    return false;
  }
  const providedBuf = Buffer.from(providedToken, 'utf8');
  const expectedBuf = Buffer.from(INTERNAL_SECRET, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Verifies Authorization: Bearer <token>.
 * Supports:
 *   1. Timing-safe INTERNAL_API_SECRET (server-to-server Cloud Function proxy)
 *   2. Firebase ID Token with revoked-token check + building admin/superadmin RBAC (when FIREBASE_AUTH_ENABLED=true)
 */
async function authenticateRequest(req, targetBuildingId = null) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'missing_bearer' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, reason: 'empty_bearer' };
  }

  if (isInternalSecretMatch(token)) {
    return { ok: true, method: 'internal_secret', actor: 'system' };
  }

  if (FIREBASE_AUTH_ENABLED) {
    try {
      const { auth, db } = await getFirebaseAdminServices();
      const decoded = await auth.verifyIdToken(token, true);
      if (decoded.superadmin === true) {
        return { ok: true, method: 'firebase_id_token', actor: decoded.uid, role: 'superadmin' };
      }

      const buildingId = targetBuildingId || String(req.headers['x-building-id'] || '').trim();
      if (!buildingId || !/^[a-zA-Z0-9_-]{1,64}$/.test(buildingId)) {
        return { ok: false, reason: 'missing_building_scope' };
      }

      const memberSnap = await db.doc(`buildings/${buildingId}/members/${decoded.uid}`).get();
      if (!memberSnap.exists) {
        return { ok: false, reason: 'not_building_member' };
      }
      const member = memberSnap.data();
      if (member?.active !== true || member?.role !== 'admin') {
        return { ok: false, reason: 'insufficient_role' };
      }

      return { ok: true, method: 'firebase_id_token', actor: decoded.uid, role: 'admin' };
    } catch {
      return { ok: false, reason: 'invalid_firebase_token' };
    }
  }

  return { ok: false, reason: 'invalid_credentials' };
}

function getCorsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Building-Id';
  }
  return headers;
}

function sendJson(req, res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getCorsHeaders(req),
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        fail(new HttpError(413, 'Payload too large.'));
        req.pause();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('error', () => {
      fail(new HttpError(400, 'Request stream error.'));
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new HttpError(400, 'Request body must be a JSON object.'));
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'Invalid JSON payload.'));
      }
    });
  });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IBAN_RE = /^[A-Z]{2}[0-9A-Z]{13,32}$/;

const server = http.createServer(async (req, res) => {
  req.setTimeout(15_000);
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();
  const clientIp = getClientIp(req);

  // 1. CORS Preflight handling (strict origin allowlist only)
  if (method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      res.writeHead(403, { Vary: 'Origin' });
      return res.end();
    }
    res.writeHead(204, getCorsHeaders(req));
    return res.end();
  }

  try {
    // 2. Minimal Liveness Health Check (no sensitive runtime/filesystem details)
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(req, res, 200, {
        status: 'ok',
        app: 'TarsasApp Banking Backend',
        timestamp: new Date().toISOString(),
      });
    }

    // All /api/bank/* routes enforce per-IP rate limiting and Bearer authentication
    const syncMatch = pathname.match(/^\/api\/bank\/sync\/([a-zA-Z0-9_-]{1,64})$/);
    if (pathname.startsWith('/api/bank/')) {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        auditLog({ action: 'rate_limit_blocked', ip: clientIp, method, pathname });
        return sendJson(
          req,
          res,
          429,
          { error: 'Too Many Requests', message: 'Rate limit exceeded. Please retry later.' },
          { 'Retry-After': String(rateCheck.retryAfterSec) }
        );
      }

      const authResult = await authenticateRequest(req, syncMatch ? syncMatch[1] : null);
      if (!authResult.ok) {
        auditLog({
          action: 'auth_denied',
          ip: clientIp,
          method,
          pathname,
          reason: authResult.reason,
        });
        return sendJson(req, res, 401, {
          error: 'Unauthorized',
          message: 'Valid Bearer authentication is required.',
        });
      }

      req._bankAuth = authResult;
    }

    // 3. Certificate Status (safe metadata only — NEVER expose filesystem paths or private keys)
    if (pathname === '/api/bank/certs/status' && method === 'GET') {
      const certCheck = validateLocalCertificates();
      const { certPath, keyPath, ...safeCertMetadata } = certCheck;
      auditLog({
        action: 'certs_status',
        ip: clientIp,
        actor: req._bankAuth?.actor,
        isValid: certCheck.isValid,
      });
      return sendJson(req, res, 200, {
        success: certCheck.isValid,
        ...safeCertMetadata,
      });
    }

    // 4. mTLS Handshake Verification
    if (pathname === '/api/bank/test-connection' && method === 'POST') {
      try {
        const testRes = await sendOtpRequest({
          endpoint: '/',
          method: 'GET',
        });
        auditLog({
          action: 'mtls_test_ok',
          ip: clientIp,
          actor: req._bankAuth?.actor,
          statusCode: testRes.statusCode,
        });
        return sendJson(req, res, 200, {
          success: true,
          message: 'OTP mTLS kapcsolatfelvétel sikeres.',
          statusCode: testRes.statusCode,
          tls: testRes.tls,
        });
      } catch (err) {
        auditLog({
          action: 'mtls_test_failed',
          ip: clientIp,
          actor: req._bankAuth?.actor,
        });
        console.warn('[mTLS test-connection failed]:', err.message);
        return sendJson(req, res, 502, {
          success: false,
          message: 'mTLS handshake failed (bank endpoint unreachable or IP not whitelisted).',
        });
      }
    }

    // 5. POST /api/bank/sync/:buildingId
    if (syncMatch && method === 'POST') {
      const buildingId = syncMatch[1];
      const body = await parseJsonBody(req);

      const {
        buildingIban,
        dateFrom,
        dateTo,
        forceMock = false,
      } = body;

      if (IS_PRODUCTION && forceMock) {
        auditLog({
          action: 'sync_mock_blocked',
          ip: clientIp,
          actor: req._bankAuth?.actor,
          buildingId,
        });
        return sendJson(req, res, 403, {
          error: 'Forbidden',
          message: 'Mock transaction mode is disabled in production.',
        });
      }

      if (dateFrom && (typeof dateFrom !== 'string' || !ISO_DATE_RE.test(dateFrom))) {
        return sendJson(req, res, 400, {
          error: 'Bad Request',
          message: 'dateFrom must match YYYY-MM-DD format.',
        });
      }

      if (dateTo && (typeof dateTo !== 'string' || !ISO_DATE_RE.test(dateTo))) {
        return sendJson(req, res, 400, {
          error: 'Bad Request',
          message: 'dateTo must match YYYY-MM-DD format.',
        });
      }

      let normalizedIban = undefined;
      if (buildingIban !== undefined && buildingIban !== null && buildingIban !== '') {
        if (typeof buildingIban !== 'string') {
          return sendJson(req, res, 400, {
            error: 'Bad Request',
            message: 'buildingIban must be a string.',
          });
        }
        normalizedIban = buildingIban.replace(/\s+/g, '').toUpperCase();
        if (!IBAN_RE.test(normalizedIban)) {
          return sendJson(req, res, 400, {
            error: 'Bad Request',
            message: 'buildingIban has invalid IBAN format.',
          });
        }
      }

      const syncResult = await syncBuildingTransactions({
        buildingId,
        buildingIban: normalizedIban,
        dateFrom,
        dateTo,
        forceMock: IS_PRODUCTION ? false : Boolean(forceMock),
      });

      auditLog({
        action: 'bank_sync',
        ip: clientIp,
        actor: req._bankAuth?.actor,
        authMethod: req._bankAuth?.method,
        buildingId,
        iban: maskIban(normalizedIban),
        success: Boolean(syncResult.success),
        count: Array.isArray(syncResult.transactions) ? syncResult.transactions.length : 0,
      });

      return sendJson(req, res, syncResult.success ? 200 : 502, syncResult);
    }

    return sendJson(req, res, 404, {
      error: 'Not Found',
      message: 'Endpoint not found.',
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return sendJson(req, res, err.statusCode, {
        error: err.statusCode === 413 ? 'Payload Too Large' : 'Bad Request',
        message: err.message,
      });
    }
    console.error('[Server Error]:', err);
    return sendJson(req, res, 500, {
      error: 'Internal Server Error',
      message: 'An unexpected server error occurred.',
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log('='.repeat(65));
  console.log(`🏦 TarsasApp OTP Bank Backend listening on http://${HOST}:${PORT}`);
  console.log(`   - Environment:      ${IS_PRODUCTION ? 'production' : 'development'}`);
  console.log(`   - Firebase ID Auth: ${FIREBASE_AUTH_ENABLED ? 'ENABLED' : 'internal secret only'}`);
  console.log(`   - Rate limit:       ${RATE_LIMIT_MAX_REQUESTS} req / ${Math.round(RATE_LIMIT_WINDOW_MS / 1000)}s per IP`);
  console.log(`   - Health check:     GET  /api/health`);
  console.log(`   - Cert status:      GET  /api/bank/certs/status (Bearer auth required)`);
  console.log(`   - Sync endpoint:    POST /api/bank/sync/:buildingId (Bearer auth required)`);
  console.log(`   - mTLS test:        POST /api/bank/test-connection (Bearer auth required)`);
  console.log('='.repeat(65));
});
