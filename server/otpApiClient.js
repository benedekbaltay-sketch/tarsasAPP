/**
 * OTP Bank Corporate & Open Banking API Client
 * 
 * Biztonságos Node.js kliens modul az OTP Bank Corporate / Open Banking (PSD2) API-hoz.
 * Kölcsönös TLS (mTLS) hitelesítés RSA 4096 bites tanúsítvánnyal és privát kulccsal.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Alapértelmezett cert könyvtár: server/certs/
const certsDir = path.join(__dirname, 'certs');

export const OTP_CONFIG = {
  // Tanúsítványok elérési útjai (előnyben részesítve a server/certs/ könyvtárat)
  certPath: process.env.OTP_CERT_PATH 
    ? path.resolve(projectRoot, process.env.OTP_CERT_PATH)
    : (fs.existsSync(path.join(certsDir, 'otp_cert.pem')) ? path.join(certsDir, 'otp_cert.pem') : path.join(projectRoot, 'otp_cert.pem')),
  keyPath: process.env.OTP_KEY_PATH 
    ? path.resolve(projectRoot, process.env.OTP_KEY_PATH)
    : (fs.existsSync(path.join(certsDir, 'otp_private.key')) ? path.join(certsDir, 'otp_private.key') : path.join(projectRoot, 'otp_private.key')),
  passphrase: process.env.OTP_KEY_PASSPHRASE || undefined,

  // OTP Open Banking végpontok
  baseUrl: process.env.OTP_API_BASE_URL || 'https://sandbox.api.otpbank.hu',
  authUrl: process.env.OTP_AUTH_URL || 'https://sandbox.api.otpbank.hu/auth/oauth2/token',
  
  // Hitelesítő adatok
  clientId: process.env.OTP_CLIENT_ID || 'SANDBOX_CLIENT_ID',
  clientSecret: process.env.OTP_CLIENT_SECRET || 'SANDBOX_CLIENT_SECRET',
  
  // Timeout
  timeoutMs: 15000,
};

/**
 * 1. Segédfüggvény: PEM szövegből az összes X.509 tanúsítvány kinyerése és elemzése
 */
export function parseCertificatesFromPem(pemString) {
  if (!pemString || typeof pemString !== 'string') return [];

  const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  const matches = pemString.match(certRegex) || [];

  return matches.map((rawPem, index) => {
    try {
      const x509 = new crypto.X509Certificate(rawPem);
      const isSelfSigned = x509.subject === x509.issuer;
      const isCa = Boolean(x509.ca);

      let role = 'client_cert';
      if (isSelfSigned && isCa) {
        role = 'root_ca';
      } else if (isCa) {
        role = 'intermediate_ca';
      } else if (isSelfSigned) {
        role = 'self_signed';
      }

      const validFrom = new Date(x509.validFrom);
      const validTo = new Date(x509.validTo);
      const now = new Date();
      const daysRemaining = Math.round((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        index,
        rawPem: rawPem.trim(),
        x509,
        subject: x509.subject,
        issuer: x509.issuer,
        serialNumber: x509.serialNumber,
        fingerprint256: x509.fingerprint256,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysRemaining,
        isExpired: daysRemaining <= 0,
        isCa,
        isSelfSigned,
        role,
        keyType: x509.publicKey?.asymmetricKeyType || 'unknown',
        keySizeBits: x509.publicKey?.asymmetricKeyDetails?.modulusLength || 4096,
      };
    } catch (err) {
      return {
        index,
        rawPem: rawPem.trim(),
        error: err.message,
      };
    }
  });
}

/**
 * OTP Szabályzat 3.1.1 szerinti tanúsítványlánc sorrend-ellenőrzése:
 * 1. Root CA (Gyökér tanúsítvány)
 * 2. Intermediate CA (ha van)
 * 3. Kliens / Szerver tanúsítvány (Leaf)
 */
export function validateOtpCertificateChain(pemString) {
  const certs = parseCertificatesFromPem(pemString);

  if (certs.length === 0) {
    return {
      isValid: false,
      isOrderCompliant: false,
      certCount: 0,
      chain: [],
      error: 'Nem található érvényes PEM tanúsítvány a megadott forrásban.',
    };
  }

  // 1 tanúsítvány esetén (pl. önaláírt teszt tanúsítvány)
  if (certs.length === 1) {
    const cert = certs[0];
    return {
      isValid: !cert.isExpired,
      isOrderCompliant: true,
      certCount: 1,
      chain: certs,
      isSingleCert: true,
      isSelfSigned: cert.isSelfSigned,
      message: cert.isSelfSigned 
        ? 'Egyrészes önaláírt teszt tanúsítvány (Sandbox/Fejlesztéshez megfelelő, egyszerre tölti be a Root és Kliens szerepet).'
        : 'Egyrészes kliens tanúsítvány (Közbenső/Gyökér CA nélkül).',
    };
  }

  // Többrészes tanúsítványlánc (pl. éles banki vagy QTSP kibocsátás)
  // OTP 3.1.1 szigorú előírás:
  // - 0. elem: Root CA (isCa, általában isSelfSigned)
  // - Közbenső elemek: Intermediate CA (isCa, nem selfSigned)
  // - Utolsó elem: Kliens tanúsítvány (!isCa vagy a privát kulccsal párosítható leaf)
  const first = certs[0];
  const last = certs[certs.length - 1];

  const firstIsRoot = first.role === 'root_ca' || (first.isCa && first.isSelfSigned);
  const lastIsClient = last.role === 'client_cert' || !last.isCa || !last.isSelfSigned;

  // Ellenőrizzük, hogy nem épp fordított sorrendben van-e (Standard TLS RFC gyakran Kliens -> Intermediate -> Root)
  const isReversed = (first.role === 'client_cert' || !first.isCa) && (last.role === 'root_ca' || (last.isCa && last.isSelfSigned));

  const isOrderCompliant = firstIsRoot && lastIsClient;
  const anyExpired = certs.some(c => c.isExpired);

  return {
    isValid: isOrderCompliant && !anyExpired,
    isOrderCompliant,
    isReversed,
    certCount: certs.length,
    chain: certs,
    orderSummary: certs.map(c => `[${c.index + 1}] ${c.role.toUpperCase()}: ${c.subject?.split('\n')[0] || c.subject}`).join(' -> '),
    error: !isOrderCompliant
      ? (isReversed 
          ? 'A tanúsítványlánc fordított sorrendben van (RFC formátum: Kliens -> Root). Az OTP 3.1.1 szerint Root CA -> Intermediate CA -> Kliens sorrend kötelező!'
          : 'A tanúsítványlánc nem felel meg az OTP 3.1.1 sorrendjének (1. Root CA, 2. Intermediate CA, 3. Kliens tanúsítvány).')
      : (anyExpired ? 'A láncban legalább egy tanúsítvány lejárt!' : null),
  };
}

/**
 * Bármilyen sorrendű tanúsítványlánc automatikus átrendezése az OTP 3.1.1 szerinti formátumra:
 * [Root CA, ...Intermediate CAs, Client Certificate]
 */
export function reorderOtpCertChain(pemString) {
  const certs = parseCertificatesFromPem(pemString);
  if (certs.length <= 1) return pemString;

  // Szétválogatás szerepkör szerint
  const rootCas = certs.filter(c => c.role === 'root_ca' || (c.isCa && c.isSelfSigned));
  const intermediateCas = certs.filter(c => c.role === 'intermediate_ca' || (c.isCa && !c.isSelfSigned));
  const clientCerts = certs.filter(c => c.role === 'client_cert' || (!c.isCa && !c.isSelfSigned));

  const ordered = [...rootCas, ...intermediateCas, ...clientCerts];
  if (ordered.length === certs.length) {
    return ordered.map(c => c.rawPem).join('\n\n');
  }

  // Ha nem lehetett automatikusan kategorizálni, megfordítjuk
  return [...certs].reverse().map(c => c.rawPem).join('\n\n');
}

/**
 * Új OTP 3.1.1 kompatibilis lánc összeállítása különálló PEM blokkokból
 */
export function formatOtpCertChain({ rootCaPem, intermediateCaPem, clientCertPem }) {
  const parts = [];
  if (rootCaPem && rootCaPem.trim()) parts.push(rootCaPem.trim());
  if (intermediateCaPem && intermediateCaPem.trim()) parts.push(intermediateCaPem.trim());
  if (clientCertPem && clientCertPem.trim()) parts.push(clientCertPem.trim());
  return parts.join('\n\n');
}

/**
 * 2. Lokális tanúsítványok és kulcspár integritásának ellenőrzése (OTP 3.1.1 kompatibilis)
 */
export function validateLocalCertificates(config = OTP_CONFIG) {
  const result = {
    isValid: false,
    certExists: false,
    keyExists: false,
    certPath: config.certPath,
    keyPath: config.keyPath,
    chainValidation: null,
    details: null,
    error: null,
  };

  try {
    if (!fs.existsSync(config.certPath)) {
      throw new Error(`A tanúsítvány fájl nem található itt: ${config.certPath}`);
    }
    result.certExists = true;

    if (!fs.existsSync(config.keyPath)) {
      throw new Error(`A privát kulcs fájl nem található itt: ${config.keyPath}`);
    }
    result.keyExists = true;

    const certPem = fs.readFileSync(config.certPath, 'utf8');
    const keyPem = fs.readFileSync(config.keyPath, 'utf8');

    // 1. Tanúsítványlánc vizsgálata az OTP 3.1.1 szerint
    const chainValidation = validateOtpCertificateChain(certPem);
    result.chainValidation = {
      certCount: chainValidation.certCount,
      isOrderCompliant: chainValidation.isOrderCompliant,
      isSingleCert: chainValidation.isSingleCert,
      isReversed: chainValidation.isReversed,
      orderSummary: chainValidation.orderSummary,
      chain: chainValidation.chain.map(c => ({
        index: c.index,
        role: c.role,
        subject: c.subject,
        issuer: c.issuer,
        validTo: c.validTo,
        daysRemaining: c.daysRemaining,
        serialNumber: c.serialNumber,
      })),
      error: chainValidation.error,
    };

    if (!chainValidation.isValid) {
      throw new Error(chainValidation.error || 'A tanúsítványlánc nem érvényes.');
    }

    // 2. Megkeressük a láncban azt a tanúsítványt, amelyhez a privát kulcs tartozik
    let matchingCert = null;
    const testData = Buffer.from('OTP_INTEGRATION_TEST_PAYLOAD_' + Date.now());
    const signer = crypto.createSign('SHA256');
    signer.update(testData);
    signer.end();
    const signature = signer.sign(keyPem);

    for (const c of chainValidation.chain) {
      try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(testData);
        verifier.end();
        if (verifier.verify(c.x509.publicKey, signature)) {
          matchingCert = c;
          break;
        }
      } catch {}
    }

    if (!matchingCert) {
      throw new Error('A privát kulcs nem illeszkedik a tanúsítványlánc egyetlen tanúsítványának nyilvános kulcsához sem!');
    }

    // OTP 3.1.1 szigorítás: többrészes lánc esetén a privát kulcshoz tartozó tanúsítványnak az utolsónak (Leaf) kell lennie
    if (chainValidation.certCount > 1 && matchingCert.index !== chainValidation.certCount - 1) {
      throw new Error(`OTP 3.1.1 Szabálysértés: A kliens tanúsítvány (amelyhez a privát kulcs tartozik) a lánc ${matchingCert.index + 1}. helyén található, de az utolsó (${chainValidation.certCount}.) helyen kell szerepelnie (Root -> Intermediate -> Kliens)!`);
    }

    result.isValid = matchingCert.daysRemaining > 0;
    result.details = {
      subject: matchingCert.subject,
      issuer: matchingCert.issuer,
      serialNumber: matchingCert.serialNumber,
      fingerprint256: matchingCert.fingerprint256,
      validFrom: matchingCert.validFrom,
      validTo: matchingCert.validTo,
      daysRemaining: matchingCert.daysRemaining,
      keyType: matchingCert.keyType,
      keySizeBits: matchingCert.keySizeBits,
      keyPairMatch: true,
      matchingCertRole: matchingCert.role,
      matchingCertIndex: matchingCert.index,
      otpChainCompliant: chainValidation.isOrderCompliant,
    };

    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

/**
 * 2. Kölcsönös TLS (mTLS) HTTPS Agent létrehozása
 */
export function createOtpMtlsAgent(config = OTP_CONFIG) {
  if (!fs.existsSync(config.certPath) || !fs.existsSync(config.keyPath)) {
    throw new Error('Nem hozható létre mTLS agent: a tanúsítvány vagy kulcsfájl hiányzik.');
  }

  const cert = fs.readFileSync(config.certPath);
  const key = fs.readFileSync(config.keyPath);

  return new https.Agent({
    cert,
    key,
    passphrase: config.passphrase,
    // Banki szabvány: TLS 1.2 vagy 1.3
    minVersion: 'TLSv1.2',
    keepAlive: true,
    timeout: config.timeoutMs,
  });
}

/**
 * 3. Általános mTLS kérés küldése az OTP API felé
 */
export async function sendOtpRequest({
  endpoint,
  method = 'GET',
  headers = {},
  body = null,
  config = OTP_CONFIG,
}) {
  const agent = createOtpMtlsAgent(config);
  const url = new URL(endpoint.startsWith('http') ? endpoint : `${config.baseUrl}${endpoint}`);

  const requestId = crypto.randomUUID();
  const defaultHeaders = {
    'X-Request-ID': requestId,
    'Accept': 'application/json',
    'User-Agent': 'TarsasApp-OTP-Client/1.0',
    ...headers,
  };

  if (body && !defaultHeaders['Content-Type']) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: method.toUpperCase(),
      agent,
      headers: defaultHeaders,
      timeout: config.timeoutMs,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }

        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          data: parsed,
          tls: {
            authorized: res.socket?.authorized,
            protocol: res.socket?.getProtocol?.(),
            cipher: res.socket?.getCipher?.(),
          },
        });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Hálózati / TLS hiba az OTP kérés során: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Időtúllépés (${config.timeoutMs} ms) az OTP végpont elérésekor.`));
    });

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }
    req.end();
  });
}

/**
 * 4. OAuth2 Access Token kérése (Client Credentials Flow)
 */
export async function getOtpOAuthToken({
  clientId = OTP_CONFIG.clientId,
  clientSecret = OTP_CONFIG.clientSecret,
  scope = 'aisp',
  config = OTP_CONFIG,
} = {}) {
  const bodyParams = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  }).toString();

  return sendOtpRequest({
    endpoint: config.authUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams,
    config,
  });
}

/**
 * 5. Számlák listázása (AISP - Account Information Services)
 */
export async function getOtpAccounts({ accessToken, config = OTP_CONFIG }) {
  if (!accessToken) throw new Error('accessToken megadása kötelező a számlák lekéréséhez.');

  return sendOtpRequest({
    endpoint: '/open-banking/v1.0/accounts',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    config,
  });
}

/**
 * 6. Számlatranzakciók lekérése adott időszakra
 */
export async function getOtpTransactions({
  accessToken,
  accountId,
  dateFrom,
  dateTo,
  config = OTP_CONFIG,
}) {
  if (!accessToken) throw new Error('accessToken megadása kötelező a tranzakciók lekéréséhez.');
  if (!accountId) throw new Error('accountId megadása kötelező.');

  const queryParams = new URLSearchParams();
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);

  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const endpoint = `/open-banking/v1.0/accounts/${encodeURIComponent(accountId)}/transactions${queryStr}`;

  return sendOtpRequest({
    endpoint,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    config,
  });
}

/**
 * 7. OTP Bank API tranzakciók normalizálása a TarsasApp könyvelési sémájára
 */
export function normalizeOtpTransaction(otpTx, buildingId) {
  // Ha explicit CRDT vagy DBIT van megadva, az élvez elsőbbséget
  const isCredit = otpTx.creditDebitIndicator === 'CRDT' 
    ? true 
    : (otpTx.creditDebitIndicator === 'DBIT' ? false : Number(otpTx.amount?.amount || otpTx.amount || 0) > 0);

  const rawAmount = Math.abs(Number(otpTx.amount?.amount || otpTx.amount || 0));
  
  // Dátum formázás YYYY-MM-DD
  let txDate = otpTx.bookingDate?.date || otpTx.valueDate?.date || otpTx.bookingDateTime || otpTx.date || new Date().toISOString().split('T')[0];
  if (typeof txDate === 'string' && txDate.includes('T')) {
    txDate = txDate.split('T')[0];
  }

  const comment = otpTx.remittanceInformationUnstructured || 
                  otpTx.remittanceInformation?.unstructured || 
                  otpTx.description || 
                  otpTx.comment || '';

  const partnerName = isCredit 
    ? (otpTx.debtorName || otpTx.debtor?.name || otpTx.partnerName || '')
    : (otpTx.creditorName || otpTx.creditor?.name || otpTx.partnerName || '');

  const partnerAccount = isCredit
    ? (otpTx.debtorAccount?.iban || otpTx.debtorAccount?.identification || otpTx.partnerAccount || '')
    : (otpTx.creditorAccount?.iban || otpTx.creditorAccount?.identification || otpTx.partnerAccount || '');

  const bankTxId = otpTx.entryReference || otpTx.transactionId || otpTx.bankTxId || `otp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  return {
    id: `otp_${bankTxId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    buildingId,
    type: isCredit ? 'Befizetés' : 'Kiadás',
    amount: isCredit ? rawAmount : -rawAmount,
    date: txDate,
    partnerName,
    partnerAccount,
    comment,
    bankTxId,
    source: 'OTP_CORP_API',
    importedAt: new Date().toISOString(),
    status: 'Pending', // Subject to matching / review in wizard
  };
}

/**
 * 8. Teljes társasházi szinkronizációs folyamat
 */
export async function syncBuildingTransactions({
  buildingId,
  buildingIban,
  dateFrom,
  dateTo,
  forceMock = false,
  config = OTP_CONFIG,
}) {
  // Ha teszt/fejlesztői módban vagyunk, vagy a távoli OTP szerver még nincs konfigurálva
  if (forceMock || config.clientId === 'SANDBOX_CLIENT_ID' || !config.clientId) {
    // Élethű OTP tranzakciós válasz generálása a teszteléshez
    const mockToday = new Date().toISOString().split('T')[0];
    const mockTxs = [
      {
        transactionId: `TX-OTP-${Date.now()}-01`,
        amount: { amount: '48500.00', currency: 'HUF' },
        creditDebitIndicator: 'CRDT',
        bookingDate: { date: mockToday },
        debtorName: 'Nagy Anna (Fsz. 1)',
        debtorAccount: { iban: 'HU42 1177 3016 0000 1234 0001 0000' },
        remittanceInformationUnstructured: 'Közös költség Batyu u 21 1. lakás nov',
      },
      {
        transactionId: `TX-OTP-${Date.now()}-02`,
        amount: { amount: '35200.00', currency: 'HUF' },
        creditDebitIndicator: 'CRDT',
        bookingDate: { date: mockToday },
        debtorName: 'Kovács Péter',
        debtorAccount: { iban: 'HU42 1177 3016 0000 1234 0002 0000' },
        remittanceInformationUnstructured: 'Fsz 2 lakás KK és FA befizetés',
      },
      {
        transactionId: `TX-OTP-${Date.now()}-03`,
        amount: { amount: '12450.00', currency: 'HUF' },
        creditDebitIndicator: 'DBIT',
        bookingDate: { date: mockToday },
        creditorName: 'Fővárosi Vízművek Zrt.',
        creditorAccount: { iban: 'HU42 1177 3000 2222 3333 4444 0000' },
        remittanceInformationUnstructured: 'Számlaszám: VIZ-2026-11-998 Batyu u. vízdíj',
      },
      {
        transactionId: `TX-OTP-${Date.now()}-04`,
        amount: { amount: '4100.00', currency: 'HUF' },
        creditDebitIndicator: 'DBIT',
        bookingDate: { date: mockToday },
        creditorName: 'OTP Bank Nyrt.',
        creditorAccount: { iban: 'HU42 1170 0000 0000 0000 0000 0000' },
        remittanceInformationUnstructured: 'Havi számlavezetési díj',
      }
    ];

    const normalized = mockTxs.map(tx => normalizeOtpTransaction(tx, buildingId));
    return {
      success: true,
      mode: 'mock_sandbox',
      buildingId,
      totalCount: normalized.length,
      transactions: normalized,
      message: 'OTP Bank Sandbox / Mock tranzakciók sikeresen betöltve.',
    };
  }

  // Éles OTP Bank API hívás mTLS-en keresztül
  try {
    const tokenRes = await getOtpOAuthToken({ config });
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      throw new Error(`Nem sikerült OAuth2 tokent szerezni az OTP-től: ${JSON.stringify(tokenRes.data)}`);
    }

    // Számlák lekérése
    const accountsRes = await getOtpAccounts({ accessToken, config });
    const accounts = accountsRes.data?.accounts || [];
    
    // Ha megadtak IBAN-t, azt választjuk ki, különben az első aktív számlát
    let targetAccount = accounts[0];
    if (buildingIban && accounts.length > 0) {
      targetAccount = accounts.find(a => (a.iban || '').replace(/\s/g, '') === buildingIban.replace(/\s/g, '')) || accounts[0];
    }

    if (!targetAccount?.resourceId && !targetAccount?.accountId) {
      throw new Error('Nem található elérhető OTP számla a társasházhoz.');
    }

    const accountId = targetAccount.resourceId || targetAccount.accountId;
    const txRes = await getOtpTransactions({
      accessToken,
      accountId,
      dateFrom,
      dateTo,
      config,
    });

    const rawTxs = txRes.data?.transactions?.booked || txRes.data?.transactions || [];
    const normalized = rawTxs.map(tx => normalizeOtpTransaction(tx, buildingId));

    return {
      success: true,
      mode: 'live_mtls',
      buildingId,
      accountId,
      totalCount: normalized.length,
      transactions: normalized,
    };
  } catch (err) {
    return {
      success: false,
      mode: 'live_mtls',
      buildingId,
      error: err.message,
      transactions: [],
    };
  }
}
