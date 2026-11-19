/**
 * TarsasApp Node.js Backend Server
 * 
 * Védett API szerver az OTP Bank Corporate / Open Banking integrációhoz,
 * mTLS szinkronizációhoz és tanúsítványkezeléshez.
 */

import http from 'node:http';
import { URL } from 'node:url';
import { 
  validateLocalCertificates, 
  sendOtpRequest, 
  syncBuildingTransactions, 
  OTP_CONFIG 
} from './otpApiClient.js';

const PORT = process.env.PORT || 5001;
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || 'dev_internal_secret_change_in_production';

// Segédfüggvény: JSON válasz küldése CORS fejlécekkel
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Building-Id',
  });
  res.end(JSON.stringify(data, null, 2));
}

// Segédfüggvény: Request body beolvasása JSON-ként
async function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // DoS védelem: max 1 MB body
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// HTTP Kiszolgáló
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. CORS Preflight kezelés
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Building-Id',
    });
    return res.end();
  }

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  try {
    // 2. Health Check végpont
    if (pathname === '/api/health' && method === 'GET') {
      const certCheck = validateLocalCertificates();
      return sendJson(res, 200, {
        status: 'ok',
        app: 'TarsasApp Banking Backend',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        certStatus: {
          exists: certCheck.certExists && certCheck.keyExists,
          valid: certCheck.isValid,
          daysRemaining: certCheck.details?.daysRemaining || 0,
        }
      });
    }

    // 3. Tanúsítványok állapota (biztonságos metaadatok, privát kulcs nélkül)
    if (pathname === '/api/bank/certs/status' && method === 'GET') {
      const certCheck = validateLocalCertificates();
      return sendJson(res, 200, {
        success: certCheck.isValid,
        ...certCheck,
      });
    }

    // 4. mTLS Kapcsolatfelvétel tesztelése
    if (pathname === '/api/bank/test-connection' && method === 'POST') {
      try {
        const testRes = await sendOtpRequest({
          endpoint: '/',
          method: 'GET',
        });
        return sendJson(res, 200, {
          success: true,
          message: 'OTP mTLS kapcsolatfelvétel sikeres.',
          statusCode: testRes.statusCode,
          tls: testRes.tls,
        });
      } catch (err) {
        return sendJson(res, 200, {
          success: false,
          message: 'mTLS kézfogás sikertelen (a banki szerver elérése korlátozott vagy IP-whitelist hiányzik).',
          error: err.message,
        });
      }
    }

    // 5. POST /api/bank/sync/:buildingId
    // Banki tranzakciók szinkronizálása az adott társasházhoz
    const syncMatch = pathname.match(/^\/api\/bank\/sync\/([a-zA-Z0-9_-]+)$/);
    if (syncMatch && method === 'POST') {
      const buildingId = syncMatch[1];
      const body = await parseJsonBody(req);
      
      const {
        buildingIban,
        dateFrom,
        dateTo,
        forceMock = false,
      } = body;

      const syncResult = await syncBuildingTransactions({
        buildingId,
        buildingIban,
        dateFrom,
        dateTo,
        forceMock,
      });

      return sendJson(res, syncResult.success ? 200 : 502, syncResult);
    }

    // Ismeretlen útvonal
    return sendJson(res, 404, {
      error: 'Not Found',
      message: `A megadott útvonal (${pathname}) nem található.`,
    });

  } catch (err) {
    console.error('Szerverhiba:', err);
    return sendJson(res, 500, {
      error: 'Internal Server Error',
      message: err.message,
    });
  }
});

server.listen(PORT, () => {
  console.log('='.repeat(65));
  console.log(`🏦 TarsasApp OTP Bank Backend fut a porton: http://localhost:${PORT}`);
  console.log(`   - Health check:     GET  http://localhost:${PORT}/api/health`);
  console.log(`   - Cert státusz:     GET  http://localhost:${PORT}/api/bank/certs/status`);
  console.log(`   - Szinkronizáció:   POST http://localhost:${PORT}/api/bank/sync/:buildingId`);
  console.log(`   - mTLS Kapcsolattest: POST http://localhost:${PORT}/api/bank/test-connection`);
  console.log('='.repeat(65));
});
