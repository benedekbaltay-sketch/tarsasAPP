# Database Schema & Data Models

This document defines the complete data schemas, entities, field types, and examples for the **Társasházkezelő Portál**.

---

## 1. Top-Level State Schema (`RootState`)

The entire application state is serialized under the Firebase RTDB node `condo_state` and stored locally in `localStorage["tarsashaz_state"]`.

```typescript
interface RootState {
  currentLang: "hu" | "en";
  currentBuildingId: string;
  buildings: Building[];
  users: User[];
  calendarEvents?: CalendarEvent[];           // Cross-building & building-specific events/tasks
  activeRoleMode?: "kk" | "tenant";           // Active mode for dual-role users
  isPortfolioView?: boolean;                  // Flag indicating KK is in multi-building portfolio view
  vault?: PermanentVault;
  revision: number;              // Incremented monotonically on each write
  lastUpdated: number | string;  // Timestamp of last modification
  buildingInitialReserveCommon?: number;      // Root level shortcut for active building Common Cost reserve
  buildingInitialReserveRenovation?: number;  // Root level shortcut for active building Renovation Fund reserve
  isGridEditMode?: boolean;      // Representative grid edit mode toggle
  impersonatedFrom?: {           // SuperAdmin act-as impersonation session
    originalUser: User;
    timestamp: number;
  } | null;
}
```

---

## 2. Building (`Building`)

Represents a managed condominium property.

```typescript
interface Building {
  id: string;                                // e.g. "building-001"
  name: string;                              // e.g. "Példa utca 1. Társasház"
  taxNumber?: string;                        // Condominium tax number (e.g. "12345678-1-41")
  address: string;                           // e.g. "1051 Budapest, Példa utca 1."
  phone?: string;                            // Representative contact phone
  email?: string;                            // Representative contact email
  repName?: string;                          // Name of common representative
  repOfficeHours?: string;                   // Office hours / contact window
  repAddress?: string;                       // Representative mailing / headquarters address
  bankKK: BankAccount;                       // Bank account for Common Cost (KK)
  bankFA: BankAccount;                       // Bank account for Renovation Fund (FA)
  customBankAccounts?: CustomBankAccount[];  // Dynamic sub-accounts / funds created by KK
  buildingInitialReserveCommon: number;      // Calibrated starting reserve for KK (HUF)
  buildingInitialReserveRenovation: number;  // Calibrated starting reserve for FA (HUF)
  flats: Flat[];                             // All apartments in the building
  transactions: Transaction[];               // Verified payment records
  expenses: Expense[];                       // Building expense records
  manualDebits?: ManualDebit[];              // Manual/extra debit records
  documents?: Document[];                    // Building documents & regulations
  loans?: Loan[];                            // Condominium loans & renovation funds
  infoSections?: InfoSection[];              // Customizable information hub sections
}

interface CustomBankAccount {
  id: string;              // Unique identifier (e.g. "acc-1786542696581")
  name: string;            // Account display name (e.g. "Megtakarítási Alap")
  shortName?: string;      // 2-5 letter abbreviation for pills and quick-pay buttons (e.g. "Megt")
  account: string;         // Domestic account number or IBAN
  bank: string;            // Bank name (e.g. "OTP")
  beneficiary: string;     // Beneficiary payee name
  hasMonthlyFee: boolean;  // Controls whether monthly recurring fees and quick-pay are generated
  initialReserve: number;  // Calibrated initial reserve (HUF)
  color?: string;          // Color theme ("blue", "purple", "emerald", "amber", "sky", "indigo", "rose", "teal")
}

interface InfoSection {
  id: string;                                // e.g. "sec-1786542696581"
  tileType: "contact_only" | "contact_and_cases" | "info_and_readings";
  title: string;                             // Display name (e.g. "Számlavezető Bank", "Épületbiztosítás & Károk")
  subtitle?: string;                         // Secondary highlight text on tile card
  icon?: string;                             // Icon ID (e.g. "landmark", "shield", "umbrella", "droplets", "wrench", etc.)
  color?: string;                            // Color theme ("blue", "emerald", "sky", "amber", "purple", "rose", "slate")
  description?: string;
  quickInfo?: InfoSectionQuickInfo;          // Primary contact or meter identifier master data
  items: InfoSectionItem[];                  // Sub-records (claims, readings, docs, tasks)
}

interface InfoSectionQuickInfo {
  name?: string;                             // Organization / Contact person name
  phone?: string;                            // Official contact phone / hotline
  email?: string;                            // Contact or claim email
  accountOrPolicy?: string;                  // Bank account, policy number, customer ID
  userPlaceNumber?: string;                  // Utility point of delivery (POD) number
  meterNumber?: string;                      // Physical meter serial number
  notes?: string;                            // Instructions, office hours, notes
}

interface InfoSectionItem {
  id: string;                                // e.g. "item-1786542696581"
  title: string;                             // e.g. "Allianz Épületbiztosítás" or "2026. augusztusi leolvasás"
  subtitle?: string;                         // e.g. "1485 m³" or "Kötvényszám: AHB-9982341"
  date?: string;                             // YYYY-MM-DD
  status?: string;                           // "Aktív" | "Folyamatban" | "Kárszakértőre vár" | "Elintézve" | "Kész" | "Érvényben"
  details?: Record<string, string>;          // Flexible key-value pairs (reading delta, inspector, etc.)
  comments: InfoComment[];                   // Timestamped comment logs
  attachments: FileAttachment[];             // Uploaded files, PDFs & meter/damage photos
}

interface InfoComment {
  id: string;
  author: string;
  date: string;
  text: string;
}

interface BankAccount {
  name: string;          // Beneficiary account holder name
  shortName?: string;    // 2-5 letter abbreviation (e.g. "KK", "FA")
  account: string;       // Account number (e.g. "11700000 00000000")
  bank: string;          // Bank name (e.g. "OTP")
}
```

---

## 3. Apartment / Flat (`Flat`)

Represents an individual unit within a building.

```typescript
interface Flat {
  flatNum: string;                   // Unit identifier / code (e.g. "Fsz 1", "II 7-8", "G-01")
  unitType?: "flat" | "garage" | "storage" | "commercial" | "other"; // Independent unit classification (default "flat")
  owners?: FlatOwner[];              // Multi-owner structure (unified management of owners, co-owners, beneficiaries)
  ownerName: string;                 // Composite or single owner display name (e.g. "Kiss János (1/2), Kiss Éva (1/2)")
  email?: string;                    // Owner login email / primary contact (passwords live exclusively in Firebase Auth)
  phone?: string;                    // Primary contact phone (formatted standard, e.g. "+36 20 123 4567")
  emergencyContact?: string;         // Secondary/emergency contact details
  startDate?: string;                // Date flat joined accounting (e.g. "2026-07-01")
  monthlyFee: number;                // Monthly Common Cost (KK) fee in HUF
  renovationFee: number;             // Monthly Renovation Fund (FA) fee in HUF
  balance: number;                   // Current KK balance (computed dynamically)
  renovationBalance: number;         // Current FA balance (computed dynamically)
  initialBalance?: number;           // Baseline starting balance for KK (HUF)
  initialRenovationBalance?: number; // Baseline starting balance for FA (HUF)
  feeChangesKK?: FeeChange[];        // Historical KK fee modifications
  feeChangesFA?: FeeChange[];        // Historical FA fee modifications
  cancelledDebits?: string[];        // Array of cancelled monthly debit keys
  debitComments?: Record<string, string>; // Custom monthly debit comment overrides
  ownershipShare?: number;           // Ownership percentage (e.g. 12.46%)
  area?: number;                     // Apartment interior area in m²
  volume?: number;                   // Unit volume in m³
  terraceArea?: number;              // Terrace / balcony area in m²
  staircase?: string;                // Staircase identifier (e.g. "A", "1")
  floor?: string;                    // Floor identifier (e.g. "Fsz.", "1.")
  door?: string;                     // Door identifier (e.g. "12/A")
  hrsz?: string;                     // Land registry number (e.g. "12345/1/A/12")
  paymentCode?: string;              // Unique payment code for automatic bank notice matching (e.g. "TH01-01")
  utalaskod?: string;                // Alias for paymentCode
  purchaseDate?: string;             // Acquisition date (YYYY-MM-DD)
  saleDate?: string;                 // Sale date (YYYY-MM-DD)
  isCompany?: boolean;               // True if legal entity / company
  excludeUtility?: boolean;          // True if excluded from utilities
  garages?: AnnexItem[];             // Garages associated with flat (legacy/normalized array)
  storages?: AnnexItem[];            // Storage rooms associated with flat (legacy/normalized array)
  garageNum?: string;                // Formatted string representation of garages
  storageNum?: string;               // Formatted string representation of storages
  tenantCount?: number;              // Number of registered residents
  tenants?: FlatTenant[];            // Active and historical tenant registry
  tenantName?: string;               // Primary active tenant name
  meters?: FlatMeter[];              // Meter registry (cold/hot water, heating, electricity, gas)
  annexes?: FlatAnnex[];             // Detailed accessories & non-unit rooms list
  notes?: string;                    // Administrative notes
  totalPaid?: number;                // Computed total paid KK
  totalRequired?: number;            // Computed total prescribed KK
  renovationTotalPaid?: number;      // Computed total paid FA
  renovationTotalRequired?: number;  // Computed total prescribed FA
}

interface FlatOwner {
  id?: string;                       // Unique identifier
  role?: "owner" | "coowner" | "beneficiary"; // Role of person / entity
  name: string;                      // Full name of owner / co-owner / beneficiary
  share?: string;                    // Ownership share (e.g. "1/2", "50%", "33.33%")
  email?: string;                    // Owner contact email address
  phone?: string;                    // Owner contact phone number (formatted e.g. "+36 20 123 4567")
  emails?: string[];                 // Backward compatibility array [email]
  phones?: string[];                 // Backward compatibility array [phone]
  postalCode?: string;               // Postal code
  city?: string;                     // City
  street?: string;                   // Street address
  isPrimaryContact?: boolean;        // Designated primary contact flag
  sendEmailNotification?: boolean;   // Receive condominium notices flag
  isBoardMember?: boolean;           // Audit Board Member (SZVB tag)
  isBankPayer?: boolean;             // Known bank payer flag
  bankAccounts?: string[];           // Known bank accounts for automatic matching
}

interface FlatTenant {
  id: string;                        // Unique identifier
  name: string;                      // Tenant full name
  phone?: string;                    // Tenant contact phone
  email?: string;                    // Tenant contact email
  leaseStart?: string;               // Start date (YYYY-MM-DD)
  leaseEnd?: string;                 // End date (YYYY-MM-DD)
  isActive: boolean;                 // Active status (true = current, false = moved out / archived)
  payerName?: string;                // Known payer name if paying from separate account/company
  bankAccounts?: string[];           // Known tenant bank accounts for automatic matching
}

interface FlatMeter {
  id: string;                        // Unique identifier
  serialNumber: string;              // Factory serial number
  type: "cold_water" | "hot_water" | "heating" | "electricity" | "gas" | "other"; // Meter category
  installDate?: string;              // Installation date (YYYY-MM-DD)
  initialReading?: number;           // Initial reading at install
  currentReading: number;            // Latest recorded meter reading
  lastReadingDate?: string;          // Date of latest reading
  expiryDate?: string;               // Official verification expiration date
  removalDate?: string;              // Removal date (YYYY-MM-DD)
  finalReading?: number;             // Reading at removal
}

interface FlatAnnex {
  id: string;                        // Unique identifier
  code: string;                      // Item code / identifier (e.g. "G-02", "T-14", "TER-1")
  name: string;                      // Description (e.g. "Mélygarázs beálló", "Pince tároló")
  quantity: string | number;         // Quantity / size
  unit: string;                      // Unit ("db", "m²", "m³", "Ft")
}

interface AnnexItem {
  number?: string;
  area?: string | number;
}

interface FeeChange {
  amount: number;  // New fee amount in HUF
  date: string;    // Effective from date (YYYY-MM-DD)
}
```

### Cancelled Debits Format
Keys in `cancelledDebits` follow the pattern:
- `"{YYYY-MM-01}_{Account}"` (e.g. `"2026-09-01_FA"`, `"2026-09-01_Felújítási Alap"`, `"2026-09-01_KK"`, or `"2026-09-01_Közös Költség"`).

---

## 4. Transaction (`Transaction`)

Represents a **payment** made to the condominium (credit on flat ledger; increases building reserve).

```typescript
interface Transaction {
  id: string;                         // Prefix "t-" + timestamp (e.g. "t-1786542696581")
  date: string;                       // Payment date (YYYY-MM-DD)
  flatNum: string;                    // Flat identifier (e.g. "8-7") or "Global" / "-"
  targetAccount: "Közös Költség" | "Felújítási Alap" | string;
  amount: number;                     // Amount in HUF (positive for payments/credits, negative for deductions/transfers)
  status: "Verified" | "Pending";     // Must be "Verified" to impact ledgers
  method: "Bank Transfer" | "Cash Offset" | "Bank Fee" | string;
  comment?: string;                   // Description / reference note
  includeInBalance?: boolean;         // Default true; if false, does not affect balance
  attachments?: FileAttachment[];     // Attached receipts or bank slips
  type?: "Credit" | "Debit" | "Correction";
}

interface FileAttachment {
  name: string;      // Filename
  size: string;      // Human-readable size (e.g. "240 KB")
  data: string;      // Base64 Data URL
}
```

---

## 5. Expense (`Expense`)

Represents a **condominium expense** (decreases building reserve; if `flatNum` is assigned, also debits the flat's ledger balance).

```typescript
interface Expense {
  id: string;                         // Prefix "e-" + timestamp (e.g. "e-1786956257343")
  date: string;                       // Expense date (YYYY-MM-DD)
  flatNum?: string | null;            // Optional: assigned to specific flat (e.g. "8-7"); if present, debits flat ledger
  provider: string;                   // Vendor / utility company (e.g. "MVM", "OTP")
  targetAccount: "Közös Költség" | "Felújítási Alap" | string;
  amount: number;                     // Positive amount in HUF
  category: "Utility" | "Insurance" | "Maintenance" | "Bank Fee" | "Other" | string;
  title?: string;                     // Expense title / description
  comment?: string;                   // Expense invoice / work details
  includeInBalance?: boolean;         // Default true; if false, does not affect reserve
  attachments?: FileAttachment[];     // Attached invoice PDF / scanned bill
}
```

---

## 6. Manual Debit (`ManualDebit`)

Represents an **extra flat charge / assessment** (decreases flat balance; optionally affects building reserve when flagged).

```typescript
interface ManualDebit {
  id: string;                         // Prefix "d-manual-" + timestamp
  flatNum: string;                    // Target flat number or "Global"
  date: string;                       // Charge date (YYYY-MM-DD)
  targetAccount: "Közös Költség" | "Felújítási Alap";
  amount: number;                     // Charge amount in HUF
  category?: string;                  // Classification (e.g. "Assessment", "Maintenance")
  title?: string;                     // Item title (e.g. "Autó beálló felújítás")
  comment?: string;                   // Reason for charge
  includeInBalance?: boolean;         // Default true (impacts flat balance)
  affectsBankBalance?: boolean;       // Optional: impacts condominium bank balance
  attachments?: FileAttachment[];     // Attached bill / calculation sheet
}
```

---

## 7. Document & Folder Architecture (`Document` & `DocFolder`)

Represents official building documents, assembly protocols, bylaws, and their organizing folder hierarchy.

```typescript
interface DocFolder {
  id: string;         // Prefix "folder-" + timestamp (e.g. "folder-legal")
  name: string;       // Display name (e.g. "Közgyűlési Jegyzőkönyvek")
  color: string;      // Color token (e.g. "blue", "amber", "emerald", "indigo", "purple", "red", "slate")
  parentId?: string | null; // Parent folder ID for nested folders, or null for root
  createdAt: string;  // YYYY-MM-DD
}

interface Document {
  id: string;         // Prefix "doc-" + timestamp
  title: string;      // Display title (e.g. "Szervezeti és Működési Szabályzat")
  fileName: string;   // Original filename (e.g. "SZMSZ_Tarsashaz_Hatalyos.pdf")
  fileSize: string;   // e.g. "1.8 MB"
  fileType: string;   // e.g. "pdf", "docx", "xlsx"
  uploadDate: string; // YYYY-MM-DD
  folderId?: string | null; // Folder association (null = root level)
  hasFile?: boolean;  // Flags whether binary file is archived in condo_files
  fileData?: string;  // Transient in-memory base64 Data URL (omitted from condo_state payload)
}
```

---

## 8. User (`User`)

Represents authenticated application users.

```typescript
interface User {
  id: string;              // "admin", "superadmin", or flat number (e.g. "Fsz 2")
  uid?: string;            // Firebase Authentication UID
  name: string;            // User full name (e.g. "Kovács János")
  email: string;           // Verified login email address (passwords live exclusively in Firebase Auth)
  role: "superadmin" | "admin" | "szvb" | "Owner"; // System authorization role
  flatNum?: string;        // Assigned apartment (or "0" for system / admin)
  buildingId?: string;     // Assigned building ID (e.g. "building-001")
  phone?: string;          // User phone number
  isAdminUser?: boolean;   // Flags if user has admin privileges when switching roles
}
```

---

## 9. Permanent Vault (`PermanentVault`)

Maintains deletion tombstones to prevent resurrecting deleted objects during cloud merges.

```typescript
interface PermanentVault {
  deletedIds: string[];        // Array of deleted tx, expense, debit, or doc IDs
  deletedFlatNums: string[];   // Array of deleted apartment numbers
  lastUpdated: number;         // Timestamp of last tombstone addition
}
```

---

## 10. Condominium Loans & Renovation Funds (`Loan`)

Represents long-term renovation loans and special target fund projects.

```typescript
interface Loan {
  id: string;                                          // e.g. "loan-1730300000000"
  title: string;                                       // e.g. "Kazáncsere és hőközpont korszerűsítés"
  bankName: string;                                    // e.g. "OTP Bank"
  contractNumber: string;                              // e.g. "OTP-2024-KZ-089"
  totalProjectCost: number;                            // Total project expenditure (HUF)
  lumpSumTotalCollected: number;                       // Total up-front cash collected from exempt residents (HUF)
  principalAmount: number;                             // Actual bank loan borrowed = totalProjectCost - lumpSumTotalCollected (HUF)
  currentBalance: number;                              // Current remaining principal liability (HUF)
  termMonths: number;                                  // Duration in months (e.g. 60)
  startDate: string;                                   // Disbursement date (YYYY-MM-DD)
  endDate: string;                                     // Expected maturity date (YYYY-MM-DD)
  monthlyInstallment: number;                          // Total monthly installment payable to the bank (HUF/mo)
  interestRatePercent: number;                         // Annual interest rate (%)
  allocationType: 'ownership_ratio' | 'equal' | 'fixed_amount'; // How installment is split among financed residents
  status: 'active' | 'paid_off' | 'draft';             // Loan lifecycle state
  participants: LoanParticipant[];                     // Resident participation and exemption breakdown
  payments: LoanPayment[];                             // Bank repayment history log
  createdAt?: number;
  lastUpdated?: number;
}

interface LoanParticipant {
  apartmentId: string;                                 // Apartment number (flatNum, e.g. "1", "Fsz 2")
  ownerName: string;                                   // Resident name
  paymentMethod: 'lump_sum' | 'financed';              // 'lump_sum' = paid up-front, 'financed' = pays monthly installment
  lumpSumAmountPaid: number;                           // If lump_sum: amount paid in advance (HUF)
  monthlyContribution: number;                         // If financed: monthly installment share (HUF/mo)
  area?: number;                                       // Apartment area in m²
  ownershipRatio?: number;                             // Ownership fraction
}

interface LoanPayment {
  id: string;                                          // e.g. "lp-1730300000000"
  paymentDate: string;                                 // Repayment date (YYYY-MM-DD)
  totalPaid: number;                                   // Total debited amount = principalPaid + interestPaid + bankFee (HUF)
  principalPaid: number;                               // Principal portion repaid (HUF)
  interestPaid: number;                                // Bank interest portion (HUF)
  bankFee: number;                                     // Bank transaction / account management fee (HUF)
  remainingBalanceAfter: number;                       // Remaining principal balance after this payment (HUF)
  status: 'completed' | 'pending';                     // Payment status
  note?: string;                                       // Reference / note
}
```

---

## 11. Calendar & Tasks Event (`CalendarEvent`)

Represents planned events, deadlines, maintenance schedules, assemblies, or tasks tracked across condominiums or within a specific building.

```typescript
interface CalendarEvent {
  id: string;                                          // e.g. "ev-1731872000000"
  buildingId: string;                                  // "all" for global portfolio events, or specific buildingId (e.g. "building-001")
  title: string;                                       // Event or task title
  date: string;                                        // Event date (YYYY-MM-DD)
  time?: string;                                       // Optional start time (e.g. "18:00")
  category: "assembly" | "maintenance" | "financial" | "task" | "other"; // Color-coded category
  priority: "low" | "medium" | "high";                 // Task priority badge
  description?: string;                                // Detailed notes, agenda, instructions
  location?: string;                                   // Meeting room, building basement, etc.
  isDone?: boolean;                                    // Completion toggle for task checklist
  createdAt: string;                                   // Creation timestamp (ISO string)
}
```

### Event Categories & Color Codes
- **`assembly`** (Közgyűlés): Indigo badge (`bg-indigo-100 text-indigo-700 border-indigo-200`)
- **`financial`** (Pénzügyi / Hitel határidő): Amber badge (`bg-amber-100 text-amber-700 border-amber-200`)
- **`maintenance`** (Karbantartás / Műszaki): Emerald badge (`bg-emerald-100 text-emerald-700 border-emerald-200`)
- **`task`** (Teendő / Feladat): Blue badge (`bg-blue-100 text-blue-700 border-blue-200`)
- **`other`** (Egyéb): Slate badge (`bg-slate-100 text-slate-700 border-slate-200`)

---

## 12. Security Rules & Cloud Synchronization (`database.rules.json`)

### 12.1 Realtime Database Security Rules
A felhőbeli adatbázis hozzáféréseit a projekt gyökerében lévő `database.rules.json` vezérli (`europe-west1`):
```json
{
  "rules": {
    "condo_state": {
      ".read": "auth != null",
      ".write": "auth != null && newData.exists() && newData.hasChildren(['buildings', 'users', 'lastUpdated'])"
    },
    "condo_files": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 10.2 Dedicated Binary File Storage (`condo_files`)
A nagyméretű PDF és képfájlok bináris adatai (`fileData`) nem terhelik a könyvelési `condo_state` folyamatos valós idejű szinkronizációját, hanem a különálló `condo_files/${id}` csomópontban tárolódnak.
- **20 KB könyvelési állapot**: A napi könyvelési tételek mentésekor kizárólag a könnyűsúlyú metaadatok kerülnek átvitelre, drasztikusan lecsökkentve a mentési időt 0,05 másodperc alá.
- **Igény szerinti letöltés**: A felhasználó a dokumentum letöltésekor közvetlenül a `condo_files/${id}` csomópontból tölti le a fájl tartalmát.
```
- **Kötelező hitelesítés**: Névtelen vagy jogosulatlan kérések nem férhetnek hozzá a `condo_state` csomóponthoz.
- **Séma integritás**: A felhőbe küldött adatcsomagnak kötelezően tartalmaznia kell a `buildings`, `users` és `lastUpdated` mezőket, megelőzve az üres vagy csonka állapotok mentését.
- Részletes kockázatelemzés és további keményítési javaslatok: lásd [docs/SECURITY_AND_DATA_PROTECTION.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/SECURITY_AND_DATA_PROTECTION.md).

### 12.2 Incident Analysis: Incognito Mode Outdated Data (2026-09-09)
- **Root Cause**: Firebase test-mode projects generate an automatic 30-day expiration rule (`"now < 1788904800000"`, expiring 2026-09-08 22:00:00 UTC). When this timestamp elapsed, Firebase RTDB began rejecting all client connections with `PERMISSION_DENIED`.
- **Symptom**: In regular browser windows, the user continued to see their cached `localStorage` data. In incognito windows (or new devices), `localStorage` was clean, and because RTDB denied access, the app fell back to hardcoded initial seed values from `defaultData.js` (showing outdated balances and only 14 transactions).
- **Data Integrity Audit**: No data was lost. The cloud database contained all 25 transactions, 5 expenses, 8 flats, custom representative sections, and vault tombstones (`revision: 249`).
- **Resolution**:
  1. Permanent database rules were deployed via `firebase deploy --only database` removing the expiration limit.
  2. Full snapshot backup exported to `condo_state_backup.json`.
  3. `AppContext.jsx` updated so uninitialized sessions (e.g. incognito) adopt authoritative cloud state directly.
  4. `src/constants/defaultData.js` updated to match authoritative cloud state.

### 12.3 Historical Renovation Fund (FA) Backfill (2026-10-06)
- **Scope**: Complete backfill of bank statement history for the Renovation Fund starting from **2025.06.01** to **2026.10.01** (17 ledger months).
- **Data Ingestion**: 105 bank transaction rows ($950\,356\text{ Ft}$ inflow) mapped to individual apartments and general interest.
- **Special Offsets**: Flat 2 waste collection cash payment ($12\,000\text{ Ft}$ credit) offset by building maintenance cash expense ($12\,000\text{ Ft}$ debit).
- **Extraordinary Assessments**: $70\,290\text{ Ft}$ automatic gate debits for flats 1, 4, 6, 9 and $140\,580\text{ Ft}$ ($2\times$) for flat 7-8.
- **Reconciliation Result**: Exact $100.00\%$ match across all 8 apartments and total FA reserve ($1\,332\,883\text{ Ft}$). Total transactions expanded from 39 to 123 (17 KK + 106 FA).

---

## 13. Strict Data Integrity & System Operating Mandates

> [!CAUTION]
> ### 🛑 SZABÁLY 3: SZIGORÚ ADATBÁZIS-MÓDOSÍTÁSI ÉS JÓVÁHAGYÁSI SZABÁLY (USER MANDATE)
> **A FIREBASE-BEN (VAGYIS A HONLAPON TÁROLT ADATOKBA) BELENYÚLNI SZIGORÚAN TILOS, CSAK AKKOR SZABAD, HA ERRE A FELHASZNÁLÓ EXPLICITE UTASÍTÁST AD! HA NEM AD UTASÍTÁST, TILOS VÁLTOZTATNI RAJTA.**
> 1. **Zero Automated Live Test Mutations**: Automated test scripts (headless browser tests, unit tests, CLI scripts) must NEVER insert, modify, or delete real records in the live Firebase database (`https://tarsashaz-cfe5d.web.app` or RTDB). Automated tests must run exclusively against in-memory mock fixtures.
> 2. **Mandatory Prior Confirmation**: Before adding, editing, or deleting any transaction, flat, expense, manual debit, or initial account balance in the database, the assistant must explicitly query the user and proceed **only upon receiving explicit authorization**.
> 3. **Permanent Scope**: This rule is immutable, permanent, and applies to all current and future sessions across the repository.

> [!IMPORTANT]
> ### 🌐 RENDSZER-ALAPSZABÁLYOK ÖSSZEGZÉSE:
> 1. **Kétnyelvűség (Bilingual Mandate)**: Mindent angolra is le kell fordítani (`hu` és `en` nyelvváltás a `translations.js` révén).
> 2. **Dokumentáció (Documentation Mandate)**: Mindent dokumentálni kell, változás esetén a `/docs` azonnal frissítendő és mankóként használandó új feladatoknál.
> 3. **Adatbázis-védelem (Strict DB Mandate)**: Tilos önkényes módosítás a felhőbeli adatokban.
> 4. **Adatbiztonság és Feltörhetetlenség (Security Mandate)**: Folyamatos törekvés a maximális biztonságra és proaktív javaslattétel gyenge pontok esetén.


---

## 14. Multi-Tenant Cloud Firestore Schema (Phase 1 Target Architecture)

Migrated multi-tenant collections defined in `firestore.rules`, `firestore.indexes.json`, `functions/src/`, and `scripts/rtdbToFirestoreTransform.js`:

| Collection Path | Purpose | GDPR / RBAC Access |
| :--- | :--- | :--- |
| `users/{uid}` | User directory, UI preferences, `memberships` portfolio index, `isSuperAdmin` | Self R + Prefs W; SuperAdmin R; Roles managed by Cloud Functions only |
| `buildings/{buildingId}` | Building metadata, bank accounts, non-secret `bankApi`, live `balances` (`KK`, `FA`, `custom`), GDPR-safe `aggregates` (`totalArrearsHuf`, debtor/settled counts) | All active members R; Admin metadata W; Financial totals written strictly via Cloud Functions |
| `buildings/{buildingId}/members/{uid}` | Authoritative RBAC role (`admin` \| `szvb` \| `owner`), `unitIds[]`, `active`, optional `accessFromDate` (ownership transfer privacy) | Admin R (building), Self R; Server-managed only (`allow write: if false;`) |
| `buildings/{buildingId}/units/{unitId}` | 5-tab unit model (`unitType`, `owners[]`, `tenants[]`, `meters[]`, `accessories[]`), `ownerUids[]`, `fees`, atomic `balances`, own `activeLoanShares[]` | Admin R/W (non-financial); SZVB R/O all; Owner R own unit (`uid in ownerUids`) + `{phone, emergencyContact, notes}` W |
| `buildings/{buildingId}/categories/{catId}` | Dynamic bilingual income/expense categories, `defaultFund`, `allocationBasis`, auto-matching `keywords[]` | Members R; Admin R/W |
| `buildings/{buildingId}/transactions/{txId}` | Unified server-paginated ledger (50/page) — payments, expenses, manual debits, materialized monthly assessments (`assess_YYYY-MM_unitId_fund`), transfers, corrections | Admin & SZVB R all; Owner R own unit (`unitId in member.unitIds` & `>= accessFromDate`) + building expenses (`visibility == 'building' && unitId == null`); Writes strictly via `mutateTransaction` Cloud Function (`allow write: if false;`) |
| `buildings/{buildingId}/monthlySummaries/{YYYY-MM}` | GDPR-safe monthly rollup (`totalInflowHuf`, `totalOutflowHuf`, `netMarginHuf`, per-fund totals) | Members R; Cloud Functions W only |
| `buildings/{buildingId}/loans/{loanId}` | Full loan contracts, participants & repayment schedules | **Admin & SZVB ONLY**; Regular Owners DENIED |
| `buildings/{buildingId}/auditLogs/{logId}` | Forensic audit trail of all financial & master-data mutations | Admin & SZVB R; Append-only (`allow update, delete: if false;`) |
| `buildings/{buildingId}/documents/{docId}` | Document metadata with Cloud Storage `storagePath` (zero inline Base64) | Admin R/W; SZVB R/O; Owner R (`visibility == 'building'`) |
| `buildings/{buildingId}/infoSections/{id}` & `calendarEvents/{id}` | Building info tiles & calendar events with `visibility: 'building' \| 'admin'` | Admin R/W; SZVB R/O; Owner R (`visibility == 'building'`) |
