# Security, Data Protection & Inviolability Specification

This document details the security architecture, authorization principles, Phase 0 emergency containment controls, and the production hardening roadmap for the **Társasházkezelő Portál**.

---

## 1. The Core Security Mandate

> [!CAUTION]
> ### 🔒 ADATBIZTONSÁGI ÉS FELTÖRHETETLENSÉGI ALAPSZABÁLY (RULE 4)
> **MINDIG ARRA KELL TÖREKEDNI, HOGY AZ ADATBIZTONSÁG ÉS A FELTÖRHETETLENSÉG ELŐRE HALADJON.**
> 1. **Proaktív sebezhetőség-feltárás**: Bármilyen fejlesztés vagy architektúrális vizsgálat során felismert gyenge pontot, kockázatot vagy támadási felületet kötelező azonnal dokumentálni és kezelni.
> 2. **Szigorú adatvédelem (Privacy-First / GDPR)**: Lakók személyes adatai (e-mail címek, telefonszámok, egyedi lakásegyenlegek, hitelek) soha nem szivároghatnak ki illetéktelen személyekhez.
> 3. **Megváltoztathatatlan felügyelet (Tamper-Resistance)**: A könyvelési tételek, egyenlegek és audit naplók kizárólag szerveroldali szabályokkal és atomi tranzakciókkal módosíthatók.

---

## 2. Phase 0 Emergency Containment Controls (Implemented in Codebase)

All Phase 0 repo-level security containment fixes have been implemented (prior to live Firebase/Firestore deployment):

1. **Zero Hardcoded PII, Passwords, or Secrets in Client Bundle**:
   - Purged all real resident names, emails, phones, plaintext passwords, reset tokens, real bank account numbers, embedded Base64 PDFs, and banking API secrets from `src/constants/defaultData.js`, `src/components/`, `src/utils/`, `src/constants/translations.js`, and `docs/`.
   - Added `stripSensitiveUserFields` and `stripSensitiveBuildingFields` in `src/context/syncEngine.js` to prevent `pass`, `password`, `resetToken`, `resetTokenExpiry`, and `bankApi.apiKey`/`clientSecret`/`secretKey` from ever entering `localStorage`, state, or cloud payloads.
2. **Strict Firebase Authentication & Session Hygiene (`src/context/authActions.js`, `src/context/AppContext.jsx`)**:
   - Removed local plaintext password fallbacks, hardcoded email aliases/prefixes, and client-side `createUserWithEmailAndPassword`.
   - `ensureFirebaseAuth()` relies strictly on `auth.authStateReady()` — zero hardcoded admin passwords or client-side auto-relogin hacks.
   - `onAuthStateChanged` clears stale cached state and unsubscribes cloud listeners whenever `!firebaseUser`.
   - `logout()` completely wipes `tarsashaz_state`, `tarsashaz_permanent_vault`, session keys, `sessionStorage`, and React memory.
   - `changePassword(currentPass, newPass)` requires `reauthenticateWithCredential` with the user's current password, enforces >= 10 characters, and updates Firebase Auth directly without persisting plaintext passwords.
   - `ForgotPasswordModal` suppresses `auth/user-not-found` differences to prevent email enumeration.
3. **Defense-in-Depth Role & UI Bypass Guards**:
   - Added `admin`/`superadmin` role checks across all mutating domain actions (`buildingActions.js`, `accountingActions.js`, `loanActions.js`, `calendarActions.js`, `updateRepProfile`, `updateGlobalSettings`, `forceSyncLocalToCloud`, `switchToKkMode`).
   - Restricted non-admin `saveFlatMaster` calls strictly to the caller's own `flatNum` and allowlisted fields `{ phone, emergencyContact, notes }`.
   - Guarded `actAsUser` strictly to `superadmin`, prevented privilege escalation in `quickLogin`, and removed insecure substring name matching from `getUserFlats` and `switchActiveFlat`.
   - Closed direct UI privilege bypasses: gated `LoansModal` (`#view=loans`) to `admin`/`superadmin`/`szvb`; gated `FullscreenTxModal` `Ctrl+C`/`Ctrl+V`/`Delete` shortcuts and `flatNum` scoping; gated `CalendarModal` day-cell creation click; added internal `isAdmin` guards to `AddBuildingModal`, `UniversalTransactionModal`, and `AddFlatModal` (including `superadmin`).
4. **Banking API Secret Isolation & Backend Hardening (`server/server.js`, `server/otpApiClient.js`, `GlobalBalancesModal.jsx`)**:
   - Removed client-side storage/display of banking API secret keys and replaced the fake 900 ms test stub with a server-side Secret Manager / KMS notice.
   - Hardened `server/server.js`: loopback default bind (`HOST || '127.0.0.1'`), strict `ALLOWED_ORIGINS` CORS allowlist (no wildcard `*`), constant-time `Authorization: Bearer <INTERNAL_API_SECRET>` enforcement (`crypto.timingSafeEqual`) on `/api/bank/*`, fail-fast startup check in production, HTTP 413 handling on >1 MB payloads, `forceMock` disabled in production, stripped host filesystem paths (`certPath`/`keyPath`) from `/api/bank/certs/status`, and sanitized 500 error messages.
   - Hardened `server/otpApiClient.js`: cached mTLS `https.Agent` with explicit `rejectUnauthorized: true`, strict HTTPS + OTP Bank hostname allowlist (SSRF protection), passphrase support in keypair validation, strict IBAN matching (fail closed — never silently fall back to `accounts[0]`), and sanitized OAuth errors.
   - Updated `package.json` `"server"` script to `node --env-file-if-exists=.env server/server.js`.
5. **Hosting Security Headers (`firebase.json`)**:
   - Added `Strict-Transport-Security`, `Content-Security-Policy`, `Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy` alongside `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.

---

## 3. Phase 1 Cloud Firestore Migration & GDPR/RBAC Architecture (Implemented Locally — Ready for Emulator & Cutover)

All Phase 1 Firestore rules, Storage rules, atomic Cloud Functions, migration/parity scripts, and GDPR UI controls have been built and verified locally (zero live Firebase deployment yet, Rule 3 respected):

1. **Multi-Tenant Cloud Firestore Schema & Security Rules (`firestore.rules`, `firestore.indexes.json`, `storage.rules`)**:
   - Multi-tenant hierarchy: `users/{uid}`, `buildings/{buildingId}`, `buildings/{buildingId}/members/{uid}`, `units/{unitId}` (5-tab model + `ownerUids[]`), `categories/{catId}`, `transactions/{txId}` (paginated 50/page), `monthlySummaries/{YYYY-MM}`, `loans/{loanId}`, `documents/{docId}`, `infoSections/{sectionId}`, `calendarEvents/{eventId}`, and immutable `auditLogs/{logId}` (`allow update, delete: if false;`).
   - **RBAC via `buildings/{bId}/members/{uid}` + `superadmin` Custom Claim**: Supports 100+ buildings without hitting JWT Custom Claims' 1,000-byte limit and provides instant (0 ms) access revocation.
   - **Strict Tht. / GDPR Enforcement in Rules & UI**:
     - **Admin (Common Rep)**: Full building read + metadata write; financial writes routed exclusively through Option A Cloud Functions (`allow write: if false;` on `transactions`, `monthlySummaries`, `balances`, `aggregates`, `loans`, `members`).
     - **SZVB (Accounting Committee)**: Read-only access to the entire building (`units`, `transactions`, `MonthlyDetailModal`, `LoansModal`, `auditLogs`), zero writes.
     - **Regular Owners**: Read-only access to own unit (`request.auth.uid in resource.data.ownerUids`), own unit transactions (optionally bounded by `accessFromDate` upon apartment ownership transfer), building-level reserves/aggregates (`buildings/{bId}`), `monthlySummaries`, and building-level expenses (`visibility == 'building' && unitId == null`). Strictly blocked from other flats' units, owner names, payments, `loans/`, and `auditLogs/`. May update only `{ phone, emergencyContact, notes }` on their own unit.
   - **Cloud Storage Security Rules (`storage.rules`)**: Building- and transaction-scoped downloads with strict 5–10 MB size caps and safe MIME allowlists (no HTML/SVG).
2. **Option A Atomic Cloud Functions Engine (`functions/`)**:
   - `mutateTransaction` (`create`/`update`/`delete`) & `calibrateBuildingBalances` execute inside single atomic Firestore `runTransaction` calls updating `transactions`, `units.balances`, `buildings.balances` + `aggregates.totalArrearsHuf`, `monthlySummaries`, and immutable `auditLogs`.
   - `scheduledMonthlyAssessments` / `triggerMonthlyAssessments`: idempotent monthly assessment materialization (`assess_${YYYY-MM}_${unitId}_${fund}`) eliminating balance drift.
   - `provisionBuilding`, `manageBuildingMember`, `manageUnitLifecycle`, and `mutateLoan` (syncing only each owner's own `activeLoanShares[]` slice).
3. **GDPR UI Controls & Firestore Client Service (`src/services/firestoreService.js`)**:
   - `FinancialSituationModal.jsx`: Regular Owners see only the **Aggregated Building Arrears Summary Card** (single building total + GDPR notice); unit-by-unit breakdown restricted strictly to Admin & SZVB.
   - `MonthlyDetailModal.jsx`: Regular Owners see only building-level expenses + their own unit's payments (zero other owner names); attachment `href` sanitized against XSS.
   - `TenantView.jsx`: Displays resident's own `activeLoanShares[]` slice directly without exposing `LoansModal`.
4. **Migration, Parity Verification & Test Suites**:
   - `scripts/rtdbToFirestoreTransform.js`, `scripts/migrateRtdbToFirestore.mjs` (Emulator default + strict Rule 3 prod guard), `scripts/verifyMigrationParity.mjs` (0-Ft HUF parity check).
   - `tests/atomicTransactions.test.mjs` (`npm run test:atomic` — 6/6 passing) & `tests/firestore.rules.test.mjs` (`npm run test:rules` for Firestore Emulator).

## 4. Phase 2 Client, Dependency & Banking Gateway Hardening (Implemented & Verified Locally)

All code-level security controls from the full 21-finding cybersecurity audit (`H-1`, `H-4`, `H-5`, `H-6`, `M-3`, `M-5`, `M-6`, `L-3`) have been implemented and verified with automated tests (`npm run test:security`, `npm run test:atomic`, `npm run test:rules`, `npm audit` = **0 vulnerabilities**):

1. **Centralized File Upload & Download Security (`src/utils/fileSecurity.js` — H-4)**:
   - Magic-byte signature validation (`%PDF-`, PNG, JPEG, WEBP, ZIP/OOXML, OLE2) + strict extension & MIME allowlist (blocking videos & executable/script formats) + tiered size caps (**10 MB** `MAX_DOCUMENT_BYTES` for repository documents like long SZMSZ PDFs in `DocumentsModal.jsx` matching `storage.rules`, **2 MB** `MAX_ATTACHMENT_BYTES` for transaction/info attachments in `UniversalTransactionModal.jsx`, `EditTransactionModal.jsx`, `RepresentativeSections.jsx`).
   - Strictly blocks `.svg`, `.html`, `.htm`, `.js`, `.xml`, and polyglot/renamed HTML/SVG files from upload, inline `<img>` preview, and download.
   - Protocol-allowlisted `isSafeDownloadUrl()` and `triggerSafeDownload()` across all attachment downloads (`MonthlyDetailModal`, `EditTransactionModal`, `DocumentsModal`, `RepresentativeSections`).
   - `stripLargeBinaries(..., { stripInlineAttachments: true })` strips inline Base64 attachments before persisting to `localStorage` without affecting cloud backups.
2. **CSV & Excel Formula Injection Neutralization (`src/utils/exportExcel.js` — H-5 / CWE-1236 & L-3)**:
   - Neutralizes leading `=`, `+`, `-`, `@`, `\t`, `\r` formula triggers on all user/bank-controlled text cells in every `.xlsx` and `.csv` export while preserving numeric types and trusted internal balance formulas.
   - Automatically revokes generated Blob ObjectURLs (`URL.revokeObjectURL`) after download.
3. **Vulnerable Dependency Elimination (`package.json` — H-6)**:
   - Removed abandoned `xlsx@0.18.5` and `xlsx-js-style@1.2.0` (eliminating SheetJS CVE-2023-30533 Prototype Pollution & CVE-2024-22363 ReDoS); replaced cleanly with pure browser/Node `write-excel-file` + `read-excel-file` + RFC-4180 CSV parser.
   - Upgraded `firebase` (`^13.4.0`), `@firebase/rules-unit-testing` (`^6.0.0`), `vite` (`^8.3.8`), `@vitejs/plugin-react` (`^6.3.0`), and pinned `@grpc/grpc-js` (`^1.14.7`) via `overrides` -> **`npm audit` reports 0 vulnerabilities**.
4. **Zero Third-Party Auth CDN Requests (`src/components/FlagIcon.jsx` — M-3)**:
   - Replaced external `https://flagcdn.com` images in `LoginView.jsx` and `Header.jsx` with inline SVG flags (100% compliant with strict CSP `img-src 'self'`).
5. **Bank Statement Parser & Payment Deep-Link Hardening (`src/utils/bankParsers.js`, `src/App.jsx`, `SmartMobilePayModal.jsx`, `src/utils/qvik.js` — M-5)**:
   - Enforced strict 10 MB size cap before parsing uploaded statements; rejected legacy binary BIFF8 `.xls` while keeping OTP HTML `.xls`, `.xlsx`, and `.csv` working seamlessly.
   - Replaced `Math.random()` fallback `bankTxId` with deterministic FNV-1a hex hashing + per-file occurrence index (100% idempotent re-imports).
   - Added **Conflict-Safe Auto-Verification Guard**: transfers where counterparty IBAN/name conflicts with another flat's notice/payment code (or close score tie) are forced to `Pending` for manual admin review.
   - Clamped and sanitized `?pay=1` query params (`amount <= 50,000,000`, sanitized `flat`/`buildingId`), blocked URL overrides of beneficiary IBAN/name, and added a bilingual verification notice.
6. **Banking Gateway Rate Limiting, Audit Logging & Firebase ID Token Support (`server/server.js`, `BankImportModal.jsx` — C-5 / M-6)**:
   - Added per-IP sliding-window rate limiter (30 req / 60s, HTTP `429` + `Retry-After`), 15s request timeout, structured JSON `[BANK_AUDIT]` logs (redacting secrets/IBANs), and optional `FIREBASE_AUTH_ENABLED=true` (`verifyIdToken(token, true)` + Firestore `buildings/{bId}/members/{uid}` admin check) alongside `INTERNAL_API_SECRET`.
   - Removed hardcoded `http://localhost:5001` from `BankImportModal.jsx`; reads `VITE_BANK_API_URL` (refusing plaintext `http://` in production) and attaches the signed-in user's Firebase ID token.
7. **Remaining Role & Client Hygiene Fixes (`ConfirmModals.jsx`, `src/main.jsx` — H-1 / L-3)**:
   - Added `'superadmin'` support to all confirmation modals in `ConfirmModals.jsx`.
   - Hardened root `ErrorBoundary` in `src/main.jsx` to display a clean bilingual generic message in production (hiding raw internal `error.message`).
8. **D-1 Cloud Firestore Runtime Adapter & Zero-`localStorage` Financial Cache (`src/services/firestoreAdapter.js`, `src/services/firestoreService.js`, `src/context/*`, `src/utils/finances.js`)**:
   - Wired full `IS_FIRESTORE_MODE` (`VITE_DATA_BACKEND=firestore`) runtime path across `AppContext.jsx`, `authActions.js`, `accountingActions.js`, `buildingActions.js`, `loanActions.js`, `calendarActions.js`, and `syncEngine.js`.
   - In Firestore mode, **zero PII or financial records are ever stored in `localStorage`** (`purgeSensitiveLocalStorage()` removes legacy `tarsashaz_state`, `tarsashaz_permanent_vault`, and `tarsashaz_logged_in_user`; only UI preferences such as `tarsashaz_lang` remain).
   - All financial writes route exclusively through Option A atomic Cloud Functions (`mutateTransaction`, `calibrateBuildingBalances`, `mutateLoan`, `provisionBuilding`, `manageUnitLifecycle`); all document/attachment binaries upload to Cloud Storage (`buildings/{bId}/...`).
   - Authoritative server-computed unit balances, building KK/FA reserves, and GDPR-safe `monthlySummaries` drive UI calculations in `src/utils/finances.js` so Regular Owners see 0-Ft exact building metrics without accessing other units' payments.
   - Upgraded `functions/` (`firebase-admin@^14.5.1`, `firebase-functions@^7.4.0`) -> **both root (`npm audit`) and `functions/` (`npm --prefix functions audit`) report 0 vulnerabilities**.
   - Verified with `npm run test:adapter` (4/4 passing), `npm run test:security` (5/5), `npm run test:atomic` (6/6), and `npm run test:rules` (5/5).
9. **Multi-Company Self-Service Team Delegation & Financial Fraud Safeguards (`src/utils/teamPermissions.js`, `src/context/teamActions.js`, `GlobalBalancesModal.jsx`, `NotificationBell.jsx`, `firestore.rules`, `functions/src/organizations.js`)**:
   - **Strict Owner-Only Building Deletion**: `canDeleteBuildings` is permanently forced `false` for all staff members both in client logic (`normalizeStaffPermissions`, `canUserDeleteBuilding`) and server-side Cloud Functions (`functions/src/organizations.js`); only the Organization Owner or SuperAdmin can delete a condominium.
   - **Anti-Privilege-Escalation Guard**: Staff with `canManageTeam` can NEVER edit/remove the Organization Owner, modify their own permissions, delegate building deletion, or grant permissions (`canCreateBuildings`, `canEditBankAccounts`, `canManageTeam`) they do not hold themselves.
   - **Default-Locked Bank Account Numbers (IBAN) + Mandatory Critical Owner Alert**: Bank account numbers (`bankKK.account`, `bankFA.account`, `customBankAccounts[].account`) and custom account add/delete actions are locked by default for staff (`canEditBankAccounts: false`, enforced in UI, `GlobalBalancesModal`, `buildingActions.js`, and `firestore.rules`). Even when explicitly enabled by the Owner, **every bank account number modification by a colleague triggers an automatic `severity: 'critical'` pale-red high-priority notification** delivered directly to the Owner's `NotificationBell` (and logged in immutable `auditLogs` in Firestore mode).
   - **Instant Offboarding & Contact Handover Hygiene**: Suspending or removing a colleague immediately revokes access across all buildings (`authActions.js`, `AppContext.jsx`, `firestore.rules`) and warns/offers 1-click reset of buildings that displayed the departing colleague's personal contact (`contactDisplayMode: 'company'`).
   - **Cryptographic Email-Bound Invites**: 128-bit random hex tokens (`?invite=<token>`) with 7-day expiry, strictly verified against the signed-in user's exact email address.
   - Verified with `npm run test:team` (7/7 passing).

---

## 5. Remaining Live Cloud / Operational Steps (Require Explicit User Approval — Rule 3)

1. **Firebase Console & Identity Platform Hardening (D-2)**:
   - Activate Blaze plan & Cloud Firestore / Storage in EU region (`eur3` / `europe-west1`).
   - Disable open public user registration (`Enable create (sign up)`) & enable Email Enumeration Protection in Firebase Auth.
   - Enforce TOTP MFA for `admin` and `superadmin` accounts.
   - Enable Firebase App Check (reCAPTCHA Enterprise) and flip `enforceAppCheck: true` on Cloud Functions.
2. **Scheduled 10-Minute Live Cutover (D-3)**:
   - Freeze legacy RTDB writes -> fresh backup -> deploy Firestore/Storage rules, indexes & Cloud Functions -> run live migration -> pass 0-Ft parity gate -> deploy Hosting with `VITE_DATA_BACKEND=firestore` -> smoke test -> rotate pilot passwords -> lock/archive legacy RTDB `condo_state`.
3. **Production OTP Bank mTLS Hosting (D-4)**:
   - Replace local self-signed test keypair with CA-signed mTLS certificate stored in Google Cloud Secret Manager.
   - Deploy `server/` to Google Cloud Run behind a Cloud NAT static egress IP (whitelisted with OTP Bank) with `FIREBASE_AUTH_ENABLED=true` and `NODE_ENV=production`.

---

## 6. Security Checklist for Development Sessions

Minden új feladat vagy módosítás során ellenőrizendő:
- [ ] Tilos új plaintext jelszót, lakói PII-t vagy API titkot a kódba, a `defaultData.js`-be, a kliensoldali DB-be vagy a dokumentációba menteni!
- [ ] Minden mutáló művelet ellenőrzi-e a jogosultságot szerveroldali szabályokban és védelmi rétegekben?
- [ ] Nem sérül-e a szigorú adatbázis-módosítási tiltás (Rule 3) éles környezetben?
- [ ] A kétnyelvűség (`hu` és `en`) és a GDPR lakás-izolációs szabályok maradéktalanul teljesülnek-e?
