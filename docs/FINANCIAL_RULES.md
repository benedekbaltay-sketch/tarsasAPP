# Financial Ledger Engine & Mathematical Rules

This document specifies the exact accounting rules, ledger timelines, running balance computations, and reserve calculations used in the **Társasházkezelő Portál**.

---

## 1. Entity Impact Matrix

Every financial record interacts with either the **Individual Flat Ledger**, the **Building Reserve Funds**, or both:

| Entity | ID Prefix | Ledger Type | Flat Balance Impact | Building Reserve Impact |
| :--- | :--- | :--- | :---: | :---: |
| **Payment (Transaction)** | `t-*` | Credit | **+ (Increases)** | **+ (Increases)** |
| **Building Expense** | `e-*` | Debit | **No Impact (0)** | **- (Decreases)** |
| **Monthly Recurring Debit**| `d-*` | Debit | **- (Decreases)** | **No Impact (0)** |
| **Manual / Extra Debit** | `d-manual-*`| Debit | **- (Decreases)** | **No Impact (0)** |

> [!NOTE]
> Building expenses (such as utility bills, insurance, or repairs) do **not** decrease individual apartment balances. They are paid out of the building's shared reserve funds. Conversely, an apartment's monthly debit decreases that apartment's standing balance but does not add money to the building's bank account until the owner actually makes a verified payment.

---

## 2. Separate Financial Accounts & Dynamic Custom Accounts

The system supports both fundamental base accounts and unlimited dynamic custom accounts:
1. **Közös Költség (`KK`)** — Common Cost (Base): Covers day-to-day building operation, cleaning, common utilities, bank fees, and representative management. Has monthly recurring fee enabled (`hasMonthlyFee: true`).
2. **Felújítási Alap (`FA`)** — Renovation Fund (Base): Dedicated long-term reserve for structural repairs, elevator modernization, roof refurbishment, and capital investments. Has monthly recurring fee enabled (`hasMonthlyFee: true`).
3. **Dynamic Custom Accounts (`customBankAccounts`)**:
   - Condominium representatives can add and manage arbitrary sub-accounts and funds (e.g. *Megtakarítási Alap*, *LTP Lakástakarék*, *Külön Alap*) via the KK Profile or the Global Reserves Modal.
   - **Account Type / Monthly Fee Configuration (`hasMonthlyFee: boolean`)**:
     - **When `hasMonthlyFee: true`**: The engine generates monthly debit entries in the flat timeline, enables monthly fee configuration per apartment (`flat.customFees[accountId]`), renders quick-pay buttons (`+<ShortName>`) on apartment cards, and enables the "1 havi díj" autofill shortcut in transaction modals.
     - **When `hasMonthlyFee: false`**: No monthly debit entries are generated, and quick-pay buttons are omitted. The account operates as an ad-hoc / dedicated reserve fund where custom incomes, expenses, and manual transactions can be recorded, with running balances and building reserves tracked accurately.

Each apartment maintains independent running balances: `flat.balance` (KK), `flat.renovationBalance` (FA), and `flat.customBalances[accountId]` (for custom funds).

---

## 3. Monthly Recurring Debit Generation (`getLedgerMonths`)

Monthly debits are generated dynamically by computing the calendar months between the start date and the current month:

```javascript
function getLedgerMonths(startDateStr) {
  // Starts on flat.startDate, or defaults to 2026-09-01 (or current month)
  // Generates array: [{ date: "YYYY-MM-01", nameHu: "YYYY Month", nameEn: "Month YYYY" }, ...]
}
```

### 3.1 Cancelled Debits
If an owner has prepaid or an agreement exempts a specific month, the debit key is recorded in `flat.cancelledDebits`.
- Check:
  ```javascript
  const cancelledKeys = [
    `${m.date}_${targetAccount}`,
    `${m.date}_${targetAccount === "Közös Költség" ? "KK" : "FA"}`
  ];
  if (flat.cancelledDebits?.some(k => cancelledKeys.includes(k))) return; // Omit debit
  ```

### 3.2 Dynamic Fee Rate Changes (`feeChangesKK`, `feeChangesFA`)
Condominiums periodically adjust monthly fees (e.g. at annual general assemblies). The fee engine resolves the effective rate as of the debit month:
1. Filter all entries in `flat.feeChangesKK` (or `FA`) where `change.date <= monthDate`.
2. Sort matching entries descending by `date`.
3. If an active entry exists, use its `amount`; otherwise, fall back to base `flat.monthlyFee` (or `flat.renovationFee`).

---

## 4. Apartment Running Balance Algorithm (`getFlatLedgerTimeline`)

The flat ledger timeline combines:
1. Generated monthly recurring debits (negative amount).
2. Manual debits from `state.manualDebits` (negative amount).
3. Verified payments from `state.transactions` (positive amount).

### 4.1 Chronological Sorting
Items are sorted strictly in ascending order:
```javascript
timeline.sort((a, b) => {
  const diff = new Date(a.date) - new Date(b.date);
  if (diff !== 0) return diff;
  if (a.type !== b.type) return a.type === "Debit" ? -1 : 1; // Debits before Credits
  return (a.id || '').localeCompare(b.id || '');
});
```

### 4.2 Running Balance Accumulation
```javascript
const baseline = targetAccount === "Közös Költség" 
  ? (flat.initialBalance || 0) 
  : (flat.initialRenovationBalance || 0);

let currentBalance = baseline;
timeline.forEach(item => {
  // Items assigned to a flat always affect the flat's running balance,
  // even if they were marked not to affect the bank account total (affectsBankBalance === false).
  if (item.includeInFlatBalance !== false) {
    currentBalance += item.amount;
  }
  item.runningBalance = currentBalance;
});

// Reversed for display (newest item first)
return timeline.reverse();
```

---

## 5. Building Reserve Computations

### 5.1 Common Cost Fund (`getBuildingReserve`)
$$\text{Reserve}_{\text{KK}} = \text{InitialReserve}_{\text{KK}} + \sum \text{Payments}_{\text{KK}} - \sum \text{Expenses}_{\text{KK}}$$

Criteria:
- Payments must be `status === "Verified"` and `targetAccount === "Közös Költség"`.
- Expenses must have `targetAccount === "Közös Költség"`.
- Both must satisfy `includeInBalance !== false`.

### 5.2 Renovation Fund (`getBuildingRenovationFund`)
$$\text{Reserve}_{\text{FA}} = \text{InitialReserve}_{\text{FA}} + \sum \text{Payments}_{\text{FA}} - \sum \text{Expenses}_{\text{FA}}$$

---

## 6. Global Bank Balance Calibration (`setGlobalBalances`)

When the representative inputs the **exact current bank balance** (e.g. from an OTP statement), the system back-calculates the necessary starting baseline without rewriting past transactions:

$$\text{InitialReserve}_{\text{KK}} = \text{CurrentBankBalance}_{\text{KK}} - \sum \text{Payments}_{\text{KK}} + \sum \text{Expenses}_{\text{KK}}$$

$$\text{InitialReserve}_{\text{FA}} = \text{CurrentBankBalance}_{\text{FA}} - \sum \text{Payments}_{\text{FA}} + \sum \text{Expenses}_{\text{FA}}$$

This preserves mathematical integrity across all historical ledgers.

---

## 7. Monthly Performance Margins (`getMonthlyStats`)

For any given year and month (e.g. `2026-08`):
$$\text{Inflow} = \sum_{\text{Month}} \text{Verified Payments}$$
$$\text{Outflow} = \sum_{\text{Month}} \text{Expenses}$$
$$\text{Margin} = \text{Inflow} - \text{Outflow}$$

A positive margin indicates surplus cashflow for the month; a negative margin indicates operating deficit.

---

## 8. Currency Formatting Standard (`formatCurrency`)

- Format: Hungarian Forint with space thousand separator and `Ft` suffix.
- Negative sign placed immediately before the digits: `-14 992 Ft`.
- Rounded to the nearest whole Forint:
  ```javascript
  const formatted = Math.abs(Math.round(amount)).toLocaleString('hu-HU');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted} Ft`;
  ```

---

## 9. General Assembly Accounting & Report Generator (`src/utils/assembly.js`)

Official condominium balance reports presented to the annual General Assembly (Közgyűlés) comply with the Hungarian Condominium Act (Tht.):

### 9.1 Strict Timing Rule for Opening Balance
- **Opening Balance ($\text{Nyitó}$)**: Evaluated at the exact second before the period start date (i.e. `startDate 00:00:00` minus 1 millisecond).
- For example, for a reporting period starting `2026.01.01`, the Opening Balance represents the closing balance at `2025.12.31 23:59:59`.
- **Zero Double-Counting**: The first day's prescription (e.g. `2026.01.01` monthly fee) belongs strictly to **Period Prescriptions**, never to the Opening Balance.

### 9.2 Period Financial Components
For each apartment and account (KK and FA):
1. **$\text{Nyitó egyenleg}$ (Opening Balance)**: Baseline as of period start.
2. **$\text{Időszaki előírás}$ (Period Prescriptions)**: Sum of all regular monthly fees and manual assessment debits effective within $[startDate, endDate]$.
3. **$\text{Időszaki befizetés}$ (Period Payments)**: Sum of all verified payments credited within $[startDate, endDate]$.
4. **$\text{Záró egyenleg}$ (Closing Balance)**:
   $$\text{Záró} = \text{Nyitó} - \text{Előírás} + \text{Befizetés}$$
   *(Or algebraically: $\text{Nyitó} + \text{Előírás}_{\text{negatív}} + \text{Befizetés} = \text{Záró}$)*

### 9.3 Structured Excel Generation & Formulas
- Generated `.xlsx` files contain **live dynamic Excel formulas** for Closing Balance (`=D{row}-E{row}+F{row}` or `=D{row}+E{row}+F{row}`) rather than baked static numbers.
- Separate structured rows per flat for Common Cost (KK) and Renovation Fund (FA).
- Formatted headers: `Albetét`, `Tulajdonos(ok)`, `Alap`, `Nyitó`, `Előírás`, `Befizetés`, `Záró`.
- Unit labels use clean alphanumeric notations (e.g. `Fsz 1.`) without redundant words like "lakás" or "garázs".

---

## 10. Multi-Flat Multiplier Assessment Calculations

When recording extraordinary renovation contributions or facility fees across multiple apartments via the Universal Transaction Modal:
$$\text{Charge}_i = \text{BaseUnitAmount} \times \text{Multiplier}_i$$
- **$\text{BaseUnitAmount}$**: Single unit base fee (e.g. `70 290 Ft`).
- **$\text{Multiplier}_i$**: Stepper value assigned to apartment $i$ (default: $1\times$, adjustable to $2\times$, $3\times$, etc., reflecting e.g. multiple parking spaces).
- The total assessed across all selected flats is:
  $$\text{TotalAssessment} = \sum_{i \in \text{Selected}} (\text{BaseUnitAmount} \times \text{Multiplier}_i)$$

---

## 11. Strict 1-Month Fee Calculation (`getCurrentFee`)

Quick payment buttons (`+KK` and `+FA`) on apartment cards operate on a strict 1-month fee policy:
- **Amount Resolution**:
  ```javascript
  const oneMonthKK = getCurrentFee(flat, 'KK') > 0 
    ? getCurrentFee(flat, 'KK') 
    : (Number(flat.monthlyFee) || 0);
  ```
- **Independent of Arrears**: Whether the apartment has significant arrears (e.g. `-150 000 Ft`), is fully settled (`0 Ft`), or has an overpayment (`+25 000 Ft`), the quick action **strictly records exactly 1 monthly fee**.
- Automatically incorporates any active fee schedule modifications from `flat.feeChangesKK` or `flat.feeChangesFA`.

---

## 12. Renovation Fund (FA) Production Baseline & Calibration (2026.06.01 – 2026.10.06)

Effective October 2026, the condominium's Renovation Fund (`Felújítási Alap`) accounting was formally activated and locked to the baseline date of **2026.06.01** (the date of the Common Representative's administration takeover):

### 12.1 Bank Account Baseline
- **Baseline Inception Date**: `2026-06-01`
- **Starting Bank Reserve (`buildingInitialReserveRenovation`)**: $951\,300\text{ Ft}$
- **Active Period Bank Transactions**: 32 verified bank items from 2026.06.01 to 2026.10.06.
- **Total Period Bank Inflow**: $381\,583\text{ Ft}$ (including $1\text{ Ft}$ bank interest).
- **Target Bank Balance (as of 2026.10.06)**:
  $$\text{Reserve}_{\text{FA}} = 951\,300 + 381\,583 = 1\,332\,883\text{ Ft}$$

### 12.2 Cash Handling for Representative Waste Collection (Flat 2)
- Recorded as a single verified cash item:
  - **ID**: `t-cash-2026-07-17-fsz2-12000`
  - **Amount**: $12\,000\text{ Ft}$
  - **Date**: `2026-07-17`
  - **Flat**: `Fsz 2`
  - **Target Account**: `Felújítási Alap`
  - **Payment Method**: `Készpénz`
  - **Sender**: `Közös Képviselő (Minta Tulajdonos)`
  - **Comment**: `Kuka mozgatási díj KP`
  - **Flags**: `includeInBalance: true` (credits Flat 2 ledger), `affectsBankBalance: false` (does not affect bank statement balance).
- **Zero Duplicate Expense**: No duplicate / artificial building expense is recorded. The bank reserve functions (`getBuildingReserve`, `getBuildingRenovationFund`) exclude non-bank cash transactions, keeping the bank fund exactly at $1\,332\,883\text{ Ft}$ while Flat 2 correctly reflects the $-9\,070\text{ Ft}$ closing balance.

### 12.3 Monthly Prescriptions & Starting Balance Reconciliation (5 Months)
All flats have `startDateFA: "2026-06-01"`, generating 5 monthly debits for the Renovation Fund (June, July, August, September, October 2026). Common Fee (KK) maintains its independent start schedule (`startDateKK`, preserving historical KK balances). The opening balances (`initialRenovationBalance` as of 2026.06.01 morning, before June prescription) and closing reconciliations are:

| Albetét | Havi FA díj | 5 havi előírás | Banki befizetések | Egyéb tételek | Induló egyenleg (`2026.06.01`) | Záró egyenleg (`2026.10.06`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Fsz 1** | $5\,981\text{ Ft}$ | $29\,905\text{ Ft}$ | $54\,066\text{ Ft}$ | Célbefizetés: $-70\,290\text{ Ft}$ | **$-11\,962\text{ Ft}$** | **$-58\,091\text{ Ft}$** |
| **Fsz 2** | $4\,214\text{ Ft}$ | $21\,070\text{ Ft}$ | $4\,214\text{ Ft}$ | Készpénz: $+12\,000\text{ Ft}$ | **$-4\,214\text{ Ft}$** | **$-9\,070\text{ Ft}$** |
| **Fsz 3** | $4\,912\text{ Ft}$ | $24\,560\text{ Ft}$ | $19\,648\text{ Ft}$ | — | **$0\text{ Ft}$** | **$-4\,912\text{ Ft}$** |
| **I 4** | $6\,187\text{ Ft}$ | $30\,935\text{ Ft}$ | $24\,748\text{ Ft}$ | Célbefizetés: $-70\,290\text{ Ft}$ | **$0\text{ Ft}$** | **$-76\,477\text{ Ft}$** |
| **I 5** | $5\,773\text{ Ft}$ | $28\,865\text{ Ft}$ | $94\,886\text{ Ft}$ | — | **$-66\,021\text{ Ft}$** | **$0\text{ Ft}$** |
| **I 6** | $5\,773\text{ Ft}$ | $28\,865\text{ Ft}$ | $28\,865\text{ Ft}$ | Célbefizetés: $-70\,290\text{ Ft}$ | **$0\text{ Ft}$** | **$-70\,290\text{ Ft}$** |
| **II 7-8**| $11\,194\text{ Ft}$| $55\,970\text{ Ft}$| $55\,970\text{ Ft}$ | Célbefizetés: $-140\,580\text{ Ft}$| **$0\text{ Ft}$** | **$-140\,580\text{ Ft}$** |
| **II 9** | $5\,779\text{ Ft}$ | $28\,895\text{ Ft}$ | $99\,185\text{ Ft}$ | Célbefizetés: $-70\,290\text{ Ft}$ | **$0\text{ Ft}$** | **$0\text{ Ft}$** |
| **Global**| — | — | $+1\text{ Ft}$ (Kamat) | — | — | Tartalék része |
| **Összesen**| — | — | **$381\,583\text{ Ft}$** | — | **$951\,300\text{ Ft}$ (Nyitó FA)** | **Tartalék: $1\,332\,883\text{ Ft}$** |

### 12.4 Kocsikapu Célbefizetés Előírásai (`md-gate-*`)
Special renovation assessments for the automatic vehicle gate refurbishment (`Kocsikapu felújítás célbefizetés`) are recorded as `manualDebits` dated `2026-10-01`:
- **Fsz 1**: $-70\,290\text{ Ft}$ (`md-gate-2026-10-01-fsz1`, "Kocsikapu felújítás célbefizetés")
- **I 4**: $-70\,290\text{ Ft}$ (`md-gate-2026-10-01-i4`, "Kocsikapu felújítás célbefizetés")
- **I 6**: $-70\,290\text{ Ft}$ (`md-gate-2026-10-01-i6`, "Kocsikapu felújítás célbefizetés")
- **II 7-8**: $-140\,580\text{ Ft}$ (`md-gate-2026-10-01-ii78`, "Kocsikapu felújítás célbefizetés (2 garázs)")
- **II 9**: $-70\,290\text{ Ft}$ (`md-gate-2026-10-01-ii9`, "Kocsikapu felújítás célbefizetés")

---

## 13. Full Ledger Reset (2026.10.07)

Upon explicit user confirmation and instruction, the active financial movement logs and bank balances were reset to a zero baseline:
- **Transactions (`transactions`)**: 0 items (all verified payments removed).
- **Expenses (`expenses`)**: 0 items (all recorded expenses removed).
- **Manual debits (`manualDebits`)**: 0 items (gate debits cleared).
- **Common Reserve (`buildingInitialReserveCommon`)**: $0\text{ Ft}$.
- **Renovation Fund Reserve (`buildingInitialReserveRenovation`)**: $0\text{ Ft}$.
- **Master Data Preserved**: Flat ownership, tenant details, square meters, monthly fees, and renovation fee definitions were retained.
- **Safety Snapshot**: Complete database snapshot pre-reset archived at `scratch/backup_before_full_reset.json` (revision 461).

---

## 14. Global Balances Modal & Building Reserve Management UI (2026.10.07)

- **Permanent Bottom Actions Bar**:
  - `GlobalBalancesModal.jsx` restructured with a flexbox layout where the modal footer (`p-4 bg-gray-50 border-t flex justify-end gap-2.5 flex-shrink-0`) containing the **Mentés** (`Save`) and **Mégse** (`Cancel`) buttons is permanently pinned at the bottom.
  - The input body is wrapped in `overflow-y-auto flex-1 min-h-0`, preventing buttons from being clipped off on displays with low viewport heights or high DPI scaling (e.g. 125%/150%).
- **Dual Reserve Quick-Edit Buttons**:
  - In `AdminView.jsx` Card 1 (Building Reserves), both the **Közös Költség** row and the **Felújítási Alap** row now feature their own dedicated edit pencil button (`onOpenGlobalBalances`), allowing direct opening of the modal from either fund line.
- **Bank Cash-Filter Parity**:
  - Real-time preview calculations in `GlobalBalancesModal.jsx` now strictly filter with `isBankTx` (excluding cash-only payments and cash offsets), perfectly matching `getBuildingReserve` and `getBuildingRenovationFund`.

---

## 15. Backdrop Click & ESC Key Modal Dismissal (2026.10.07)

- **Backdrop Click Dismissal**:
  - Added click-outside dismissal (`onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}`) across popup modals:
    - `FlatDetailModal.jsx` (Flat details / albetét adatlap kártya)
    - `AddFlatModal.jsx` (Új lakás rögzítése)
    - `BuildingSelectorModal.jsx` (Épület / Profil választó)
    - `AddBuildingModal.jsx` (Új társasház hozzáadása)
- **Escape Key Listener**:
  - Added native `keydown` listener for `Escape` key in `FlatDetailModal.jsx` for desktop keyboard dismissal.

---

## 16. Undo Action on Recording Confirmation (2026.10.07)

- **One-Click Undo Button**:
  - Whenever a new payment, expense, manual debit, or universal transaction batch is recorded, the bottom-right confirmation toast now includes a prominent **Visszavonás** (`Undo`) button with a `RotateCcw` icon.
- **Immediate Reversal**:
  - Clicking **Visszavonás** immediately filters out and removes the newly recorded items from `transactions`, `expenses`, or `manualDebits`, and pushes the reversal to the state and Firebase cloud (`persistState(..., true)`).
  - Displays a brief confirmation toast (`Rögzítés visszavonva!`).
- **Synchronous Lifecycle**:
  - The **Visszavonás** button is integrated directly into the toast notification component and automatically disappears when the confirmation toast times out (5.5s timer) or when dismissed via the close button.
- **Bilingual Support**:
  - Added dictionary entries `undo_btn`, `action_undone`, and `recording_undone` to `translations.js` for both Hungarian and English.

---

## 17. Drag-Outside Modal Dismissal Protection (`useBackdropClose`) (2026.10.07)

- **Problem Solved**:
  - In standard DOM events, if a user starts mouse selection/drag or right-clicks inside an input or modal card and releases the mouse cursor outside on the backdrop, the browser fires a `click` event with the backdrop as target. Previously, this caused the modal to unintentionally close and discard in-progress edits.
- **`useBackdropClose` & `useBackdropPropsFactory` (`src/utils/useBackdropClose.js`)**:
  - Implemented dual-origin verification: a backdrop dismissal is ONLY triggered if BOTH `mousedown` (`e.target === e.currentTarget && e.button === 0`) AND `click` (`e.target === e.currentTarget`) strictly originate directly on the backdrop container.
  - If `mousedown` started inside the modal (e.g. dragging across text or fields), `isMouseDownOnBackdrop` is `false`, completely preventing accidental closing on `mouseup`/`click`.
- **Ubiquitous Application**:
  - Applied across all modals:
    - `FlatDetailModal.jsx`
    - `EditFlatMasterModal.jsx`
    - `EditTransactionModal.jsx`
    - `UniversalTransactionModal.jsx`
    - `GlobalBalancesModal.jsx`
    - `AddFlatModal.jsx`
    - `AddBuildingModal.jsx`
    - `BuildingSelectorModal.jsx`
    - `RepresentativeSections.jsx` (Tile Detail, Tile Edit, Item Edit, Confirm Deletions, Link Case, Image Preview Lightbox)

---

## 18. Zero-Amount Debit Support (0 Ft Előírás / Terhelés Rögzítése) (2026.10.08)

- **Legitimate Financial Use-Cases**:
  - A condominium may need to record an explicit 0 Ft assessment for an apartment (e.g., promotional or fee-holiday periods, inactive auxiliary storage/parking units, or waiving fees for a specific period without removing ledger continuity).
- **Validation Rules**:
  - In `UniversalTransactionModal.jsx`, validation for `txType === 'debit'` explicitly accepts `amount >= 0` across all three scopes (`single`, `multi`, and `global`). Payments and expenses continue to require `amount > 0`.
  - In `EditTransactionModal.jsx`, `handleSubmit` accepts `amount >= 0` whenever `effectiveItemType === 'Debit'` or `isRecurringPrescription` is true.
  - HTML input element `min` attributes dynamically adjust to `0` for debit types and `1` for credit/expense types.
- **Ledger & Mathematical Invariance**:
  - A 0 Ft debit contributes $0\text{ Ft}$ to the apartment's running balance (`currentBalance += item.amount` where `item.amount === 0`), perfectly maintaining mathematical integrity without causing `NaN`, dividing-by-zero, or corruption in `recalculateFlatBalances`.
- **Clean Neutral Display**:
  - Any 0 Ft debit or transaction renders neutrally as `0 Ft` (without misleading `+0 Ft` or `-0 Ft` signs) in `text-gray-700` with a neutral icon or badge across `FlatDetailModal`, `FullscreenTxModal`, `AdminView`, `TenantView`, and `EditTransactionModal`.

---

## 19. Flat Balance Calibration & Fee Synchronization Order (`updateFlatFees`) (2026.10.11)

### 19.1 Mathematical Calibration Model
In `FlatDetailModal`, the manager can simultaneously adjust monthly recurring fees (`monthlyFee`, `renovationFee`) and calibrate current outstanding balances (`balance`, `renovationBalance`).
The running balance invariant is:
$$\text{Balance} = \text{InitialBalance} + \sum \text{TimelineItems}$$
To force $\text{Balance} \equiv \text{TargetBalance}$, the required baseline is:
$$\text{InitialBalance} = \text{TargetBalance} - \sum \text{TimelineItems}$$

### 19.2 The Order-of-Operations Hazard
If `\sum \text{TimelineItems}` is computed using the flat's *previous* monthly fee, and the fee is updated immediately afterwards, the subsequent global ledger recomputation (`recalculateFlatBalances`) computes the timeline with the *new* fee:
$$\text{Actual Balance} = \text{InitialBalance} + \sum \text{TimelineItems}_{\text{new}}$$
$$\text{Actual Balance} = (\text{TargetBalance} - \sum \text{TimelineItems}_{\text{old}}) + \sum \text{TimelineItems}_{\text{new}}$$
$$\text{Actual Balance} = \text{TargetBalance} + (\text{Debit}_{\text{new}} - \text{Debit}_{\text{old}})$$

For example, on Flat 5 (area $43.9\text{ m}^2$, default fee $13\,751\text{ Ft}$):
If standard flat fee $14\,992\text{ Ft}$ was submitted alongside target balance $0\text{ Ft}$, the evaluation mismatch left an unexpected residual balance:
$$\Delta = -14\,992 - (-13\,751) = -1\,241\text{ Ft}$$

### 19.3 Enforced Execution Pipeline in `AppContext.jsx`
To eliminate this race condition permanently:
1. **Fee Mutation First**: Apply changes to `feeChangesKK`, `monthlyFee`, `feeChangesFA`, and `renovationFee`.
2. **Simulation State Snapshot**: Build `stateWithUpdatedFlat = { ...s, flats: s.flats.map(...) }` containing the updated fee schedules.
3. **Timeline Evaluation with New Fees**: Run `getFlatLedgerTimeline(flatNum, account, stateWithUpdatedFlat)`.
4. **Exact Baseline Computation**:
   $$\text{updated.initialBalance} = \text{Math.round}(\text{TargetBalance} - \sum \text{TimelineItems}_{\text{new}})$$
5. **Zero Residue Guarantee**: When `recalculateFlatBalances` executes, the flat's balance is guaranteed to equal $\text{TargetBalance}$ down to $0\text{ Ft}$.

---

## 20. MNB / qvik Dynamic Payment QR Codes & Mobile Banking Deeplinks (2026.10.12)

### 20.1 Overview & Regulatory Standard
The resident portal (`TenantView.jsx`) integrates the Hungarian National Bank (MNB) **qvik / HCT** instant payment standard to enable homeowners to pay outstanding Common Cost (`KK`) and Renovation Fund (`FA`) arrears instantly via their mobile banking apps.

### 20.2 Deeplink & QR Code URL Structure
Standard URI schema:
```
https://azonnalifizetes.hu/HCT/3/1/{BIC}/{BENEFICIARY_NAME}/{ACCOUNT_HOLDER}/{IBAN}/HUF{AMOUNT}///{COMMENT}/{REF_ID}
```

Parameter resolution:
- `BIC`: Condominium bank BIC/SWIFT code (e.g. `OTPVHUHBXXX` for OTP Bank). Computed via `getBankBic(bankObj)`.
- `BENEFICIARY_NAME` & `ACCOUNT_HOLDER`: Official condominium name (URI-encoded, e.g. `Pelda%20utca%201%20T%C3%A1rsash%C3%A1z`).
- `IBAN`: Condominium sub-account in 28-character Hungarian IBAN format (`HU...`). If the building configuration holds a 16- or 24-digit domestic account number, `formatHungarianIban` automatically computes the ISO 7064 MOD 97-10 check digits.
- `AMOUNT`: Integer outstanding debt amount: `Math.abs(Math.round(balance))` when `balance < 0`.
- `COMMENT`: Standardized payment comment (URI-encoded).
- `REF_ID`: Machine-readable apartment & fund identifier (e.g. `L04-KK`, `L04-FA`).

### 20.3 Comment Format Invariant (Strict Rule)
> [!CAUTION]
> **Never hardcode fixed calendar months or periods into payment comments!**
> Residents may settle multiple months of arrears at once, pay fractional balances caused by previous overpayments, or make ad-hoc contributions. Hardcoding dates corrupts bank matching.

- **Canonical Structure**: `[TÁRSASHÁZ_AZONOSÍTÓ] [LAKÁS_SZÁMA]. lakás [ALAP_TÍPUS]`
- **KK Example**: `Pelda1 4. lakas KK`
- **FA Example**: `Pelda1 4. lakas FA`

### 20.4 Conditional Rendering Matrix
| Condition | Ledger State | QR Code | Mobile Button (`.btn-mobile-pay`) | Status Badge / Action |
| :--- | :--- | :---: | :---: | :--- |
| **Arrears (`debt > 0`)** | `balance < 0` | **Displayed (`QRCodeSVG`)** | **Enabled** (`azonnalifizetes.hu/...`) | Rose debt badge + Quick copy button |
| **Settled (`debt == 0`)** | `balance == 0` | **Hidden** | **Hidden** | Green badge: *"Nincs hátralék"* |
| **Overpaid (`debt <= 0`)**| `balance > 0` | **Hidden** | **Hidden** | Green badge: *"Túlfizetés: X Ft (Nincs fizetési kötelezettség)"* |

### 20.5 Quick Copy Package
To facilitate manual desktop transfers without scanning, the UI provides a one-click copy button (`formatBankTransferPackage`) that populates the clipboard with:
```text
Kedvezményezett: {beneficiaryName}
Bankszámla (IBAN): {iban}
Összeg: {amount} Ft
Közlemény: {comment}
```

### 20.6 Streamlined Minimalist qvik QR Modal (`SmartMobilePayModal.jsx`)
1. **The Resident Dashboard UX**:
   - Permanent QR codes are omitted from apartment cards in `TenantView.jsx` to preserve a clean, uncluttered interface.
   - Apartments with arrears display an unmistakable, prominent action button: **„💳 Hátralék fizetése”** (`.btn-mobile-pay`) with standard crisp vector icon.
   - Clicking this button opens a focused, distraction-free **Minimalist qvik Payment Modal** (`SmartMobilePayModal.jsx`).
2. **Official High-Resolution qvik Logo**:
   - Features the authentic 1024px official Hungarian qvik branding (`/qvik-logo.png`) paired with clean native typography for the *"Azonnali fizetés"* (Instant Payment) lockup in navy `#25326D`.
3. **Pure QR Code & Complete Wire Transfer Package**:
   - Displays the outstanding balance, the centered MNB/qvik payment QR code, and a structured bank transfer box (IBAN, beneficiary, and reference) with a 1-click **"Összes adat másolása"** clipboard copy button.
4. **GIRO Security & PKI Cryptographic Signatures**:
   - The Hungarian qvik standard (AFR / EAM 2024) mandates a PKI digital cryptographic signature in Field 19. Without an accredited payment gateway certificate (e.g. OTP Mobil / SimplePay, Barion), raw deep links may be rejected by certain banking app validators.
   - The integrated 1-click copy package ensures residents always have an instantaneous 5-second manual paste alternative within their mobile banking apps.
5. **Aggregator Partnership Status & Button Visibility**:
   - Because self-generated qvik QR codes lack Giro PKI signatures, the dashboard "Hátralék fizetése" button is set to `SHOW_QVIK_PAY_BUTTON = false` in `TenantView.jsx`.
   - Residents continue to see their outstanding balance alongside the one-click copyable bank transfer details (IBAN, beneficiary, and comment).
   - Once a commercial contract with an accredited payment aggregator (e.g. OTP Mobil SimplePay, Barion) is completed, enabling the button is a 1-flag toggle.

---

## 21. INTER-ACCOUNT TRANSFERS, FLAT-ASSIGNED EXPENSES & COMPREHENSIVE EDITING

### 21.1 The Ledger Re-Routing Problem (Átvezetés számlák között)
When a resident mistakenly wires money to the wrong condominium bank account (e.g. paying 140,580 HUF to Közös Költség `KK` instead of Felújítási Alap `FA` for a dedicated project like "Autó beálló felújítás"):
1. **Source Account Correction**:
   - The payment mistakenly inflated the flat's KK ledger.
   - A deduction of `-140,580 Ft` must be booked on the source account (`KK`) for that flat.
2. **Destination Account Credit**:
   - A payment / credit of `+140,580 Ft` must be booked on the target account (`FA`) for that flat.
3. **Bank Balance Impact**:
   - If the condominium transfers the cash between the bank accounts, `affectsBalance: true` adjusts both bank reserve accounts atomically.

### 21.2 Flat-Assigned Expenses in Ledger Timeline
- Previously, `getFlatLedgerTimeline` in `src/utils/finances.js` only inspected `recurringDebits`, `manualDebits`, and `transactions`. If an expense was booked with `flatNum: "8-7"`, it was recorded in `state.expenses` and affected bank reserve, but was skipped in `getFlatLedgerTimeline`, resulting in no deduction on the resident's ledger.
- **Engine Rule**: Any expense in `state.expenses` with `e.flatNum === flatNum` is now integrated into `getFlatLedgerTimeline` as a ledger debit (`amount: -Math.abs(e.amount)`), immediately reducing `flat.balance` and appearing in the flat's financial timeline.

### 21.3 Dedicated Inter-Account Transfer Feature (`UniversalTransactionModal`)
- The modal features a 4th transaction type: **„Átvezetés (Számlák között)”** (`ArrowLeftRight` icon, purple theme).
- Administrators select:
  1. **Affected Flat**: Chosen flat (e.g. 8-7) or entire building.
  2. **Source Account (`fromAccount`)**: e.g. Közös Költség.
  3. **Destination Account (`toAccount`)**: e.g. Felújítási Alap.
  4. **Amount & Date**.
  5. **Bank Balance Toggle**: Synchronizes bank reserves when true.
- Submitting atomically creates the source deduction and destination credit in `state.transactions`.

### 21.4 Comprehensive Transaction Editing (`EditTransactionModal`)
- Administrators can edit **all 10 aspects** of an existing accounting entry:
  1. **Type**: Cross-convert between `Payment (+)`, `Expense (-)`, and `Debit / Assessment`.
  2. **Affected Flat**: Re-assign to any flat or entire condominium.
  3. **Target Account**: Common Cost, Renovation Fund, or custom bank accounts.
  4. **Amount & Sign**: The primary type selector (`Payment (+)`, `Expense (-)`, `Debit`) directly governs the sign. Redundant direction toggle pills were removed in favor of direct amount entry, with an optional subtle refund toggle (`Visszautalás / negatív korrekció (-)`) available only for Payments.
  6. **Date**: Standard date selector.
  7. **Category / Method**: Context-sensitive classification.
  8. **Title / Payee**: Description or vendor name.
  9. **Comment**: Explanatory notes.
  10. **Include in Balance**: Toggle bank/ledger balance influence.
  11. **Attachments**: Upload, preview, download, or delete file receipts.

---

## 22. MONTHLY PERFORMANCE DRILL-DOWN & AUDIT LEDGER (`MonthlyDetailModal`)

### 22.1 Drill-down Interaction
In `FinancialSituationModal` ("A ház pénzügyi helyzete"), the table of the previous 3 completed months (**Havi pénzügyi mérlegek**) supports instant monthly drill-down:
- **Double-Click**: Double-clicking any month row opens `MonthlyDetailModal`.
- **Keyboard Navigation (Enter / Space)**: Selecting/clicking a row and pressing `Enter` or `Space` opens `MonthlyDetailModal`.
- **Row Indicator**: A right chevron (`ChevronRight`) and tooltip prompt users that the table is interactive.

### 22.2 Monthly Data Aggregation & Bank Impact Rule
The engine strictly aggregates transactions and expenses that actually affected the condominium's bank accounts (`számlafőösszeget valóban befolyásolták`):
1. **Verified Bank Transactions**: Payments, refunds, inter-account transfers from `state.transactions` satisfying `status === 'Verified'`, `type !== 'Correction'`, `includeInBalance !== false`, and `isBankTx(tx)` (`affectsBankBalance !== false`, non-cash).
2. **Building Bank Expenses**: Invoices, utilities, maintenance payments from `state.expenses` satisfying `includeInBalance !== false` and `isBankTx(exp)`.
3. **Exclusion of Technical Items & Debits**: Purely technical entries and prescriptions/assessments (`manualDebits`) do not represent bank cash movements and are omitted from the monthly ledger view and global transaction feeds.
4. **Calculated KPIs**: Total Inflow (+), Total Outflow (-), and Monthly Cash Margin (+/-) matching `getMonthlyStats`.

### 22.3 Role-Based Permissions & Clean UI Mandate
- **Condominium Residents (`lakástulaj`)**:
  - Granted clean **read-only** transparency.
  - Can inspect, search, filter (by type and account), and download receipt attachments.
  - No modification or deletion controls are available or accessible.
  - Redundant notice banners are omitted to maximize vertical viewing space.
- **Condominium Managers (`kk` / `admin` / `superadmin`)**:
  - Full audit and editing privileges.
  - Each item displays a direct "Szerkesztés" (Pencil) action button.
  - Clicking "Szerkesztés" immediately launches `EditTransactionModal` layered above (`z-[75]`).
  - Editing an item updates the state, instantly propagating changes to the monthly ledger, building reserves, and flat balances.
- **Modal Close Architecture**: The modal is dismissed exclusively via the top-right `X` button, backdrop click, or `Escape` key; the bottom footer close button has been eliminated.

---

## 23. DECOUPLED BALANCE MECHANICS: BANK BALANCE VS. FLAT BALANCE

### 23.1 Problem Definition & Practical Real-World Scenarios
In condominium management, certain bookkeeping events and financial settlements affect an individual apartment's ledger balance without moving cash in the condominium's bank accounts:
1. **Off-bank settlement / Compensation**: An owner performs maintenance work (e.g. painting, garden care) for the building, and the representative credits the flat's ledger to offset common cost without initiating a bank wire.
2. **Cash payment directly to representative**: Recorded on the resident's card without immediately depositing into the bank account.
3. **Cross-account correction**: Bookkeeping adjustments or historical corrections applied to a specific apartment where bank funds are untouched.

Previously, setting "Befolyásolja a folyószámla egyenleget?" (`includeInBalance: false`) omitted the item from **both** the bank reserves and the flat's ledger timeline. Consequently, adjustments to Flat 2 or other flats did not update the owner's balance, causing confusion.

### 23.2 Architecture: Independent Balance Flags
The ledger engine completely decouples the bank account balance from the apartment balance:

| Property | Target Scope | Controlled by | Calculation Impact |
| :--- | :--- | :--- | :--- |
| **`affectsBankBalance`** (and legacy `includeInBalance`) | Condominium Bank Accounts (`folyószámla főösszeg`) | "Befolyásolja a folyószámla egyenleget?" Checkbox | Used by `getBuildingReserve`, `getBuildingRenovationFund`, `getBuildingReserveAsOf`, `getMonthlyStats`, and bank movement tables. When `false`, bank reserve is completely unaffected. |
| **`includeInFlatBalance`** | Individual Flat Ledger (`lakás egyenlege`) | Apartment assignment (`flatNum`) | Used by `getFlatLedgerTimeline`, `recalculateFlatBalances`, `getFlatBalanceAsOf`, and `getCombinedFlatLedgerTimeline`. Defaults to `true` for all apartment-specific entries. |

### 23.3 Mathematical Engine Behavior
In `src/utils/finances.js`:
```javascript
// Flat Ledger Timeline accumulator
let currentBalance = baseline;
timeline.forEach(item => {
  if (item.includeInFlatBalance !== false) {
    currentBalance += item.amount;
  }
  item.runningBalance = currentBalance;
});
```
- When `affectsBankBalance: false` and `includeInFlatBalance: true`:
  - The flat's ledger timeline incorporates the item with its full amount and updates `item.runningBalance`.
  - `recalculateFlatBalances` updates `flat.balance` accordingly.
  - The condominium's bank reserves (`getBuildingReserve`, `getBuildingRenovationFund`) ignore the transaction.

### 23.4 Flat Number Resilient Matching (`isMatchingFlat`)
In real condominium ledgers, apartment numbers are entered in various formats (e.g. `"2"`, `"Fsz 2"`, `"Fsz. 2."`, `"8-7"`, `"7-8"`). The `isMatchingFlat(flatA, flatB)` utility normalizes strings by removing floor prefixes (`Fsz`, `Eml`), punctuation, and sorting number pairs, ensuring 100% reliable matching across transactions, debits, expenses, and flat profiles.

### 23.5 Strict Same-Date Chronological Ordering & Running Balance Preservation (`_chronologicalOrder`)
When multiple transactions or duplicated items exist on the same calendar day (e.g. two +12 000 Ft payments on `2026-10-15`):
1. **Timestamp Extraction (`getItemTimestamp`)**:
   - Accurately resolves creation and update milliseconds from `createdAt`, `lastUpdated`, or standard ID timestamps (`tx-1792...`, `t-1787...`, `deb-...`).
2. **Forward Accumulation Order (`getFlatLedgerTimeline`)**:
   - Debits/expenses are applied at start of day before credits.
   - Older items (`timeA < timeB`) are calculated first, followed by newer items (such as pasted copies).
   - Each item records its exact calculation sequence: `item._chronologicalOrder = index`.
3. **Display Preservation (`getCombinedFlatLedgerTimeline`)**:
   - The UI displays newest items at the top and oldest at the bottom.
   - For same-date items within the same fund, `getCombinedFlatLedgerTimeline` strictly orders by `b._chronologicalOrder - a._chronologicalOrder`.
   - Guarantees that the newest transaction (e.g. `Kuka mozgatás díj (másolat)`) appears on top with the higher, final accumulated balance (+14 930 Ft), while the earlier original transaction below it retains its intermediate balance (+2 930 Ft), preventing running balance inversions.

---

## 24. CONDOMINIUM LOANS & RENOVATION TARGET FUNDS (HITELEK ÉS CÉLBEFIZETÉSEK)

### 24.1 Purpose & Real-World Mechanism
When a condominium undertakes major capital renovations (e.g., boiler replacement, facade insulation, elevator refurbishment), the required capital is typically financed through a combination of:
1. **Lump-Sum Advance Equity (`lump_sum`)**: Owners who choose to pay their share out-of-pocket up front in a single payment.
2. **Bank Renovation Loan (`financed`)**: The remaining capital borrowed from a financial institution (e.g., OTP Bank), repaid over a set term in monthly installments.

### 24.2 Mathematical Formulas & Principle
1. **Borrowed Principal Determination**:
   $$\text{principalAmount} = \max(0, \text{totalProjectCost} - \text{lumpSumTotalCollected})$$
   where $\text{lumpSumTotalCollected} = \sum_{\text{lump\_sum}} \text{lumpSumAmountPaid}$.

2. **Installment Allocation Across Financed Residents**:
   - **`ownership_ratio` (Standard / Legal Default)**:
     $$\text{monthlyContribution}_i = \text{round}\left( \text{monthlyInstallment} \times \frac{\text{area}_i}{\sum_{j \in \text{financed}} \text{area}_j} \right)$$
     The last financed apartment absorbs the integer rounding difference so:
     $$\sum_{i \in \text{financed}} \text{monthlyContribution}_i \equiv \text{monthlyInstallment}$$
   - **`equal`**: Divided equally among all financed apartments, with remainder distributed 1 Ft at a time.
   - **`fixed_amount`**: Manually specified amount per apartment.

3. **Exemption Principle (Mentesülés)**:
   - Residents who paid lump sum up front are **completely exempt** from monthly loan fee debits.
   - In `getFlatLedgerTimeline` (`src/utils/finances.js`), recurring loan debits (`d-loan-${loanId}-${flatNum}-${month}`) are generated **strictly and exclusively** for flats with `paymentMethod === 'financed'` and `monthlyContribution > 0`.
   - Lump-sum owners receive **no monthly loan debit lines**, keeping their monthly dues clean and accurate.

4. **Repayment Logging & Balance Reduction**:
   - Each payment record splits the total remittance into:
     $$\text{totalPaid} = \text{principalPaid} + \text{interestPaid} + \text{bankFee}$$
   - Bank debt reduction:
     $$\text{currentBalance}_{\text{new}} = \max(0, \text{currentBalance}_{\text{old}} - \text{principalPaid})$$
   - **Automatic Status Transition**:
     When $\text{currentBalance} = 0$, the loan status automatically transitions from `'active'` to `'paid_off'`, moving the project to the historical archive tab.

---

## 12. Bank Transaction Import & Deduplication Rules (`bankParsers.js`, `BankImportModal.jsx`)

1. **Transaction Ingestion & Identity**:
   - Each imported transaction carries a unique bank identifier:
     $$\text{bankTxId} = \text{rawBankTxId} \lor \text{hash}(\text{date}, |\text{amount}|, \text{counterpartyAccount})$$
   - Once booked, $\text{bankTxId}$ is persisted as an attribute on the transaction object (`t.bankTxId` or `e.bankTxId`).

2. **Deduplication Engine**:
   - Before presenting transactions to the user or recording them to the ledger, the engine performs two levels of deduplication checks:
     - **Level 1 (ID Match)**: If $\text{bankTxId} \in \text{existingLedgerIds}$, the transaction is marked as $\text{isDuplicate} = \text{true}$ and omitted from batch booking.
     - **Level 2 (Compound Signature Match)**:
       $$\text{Signature} = \langle \text{date}, \text{amount}, \text{flatNum}, \text{targetAccount} \rangle$$
       If a record with identical date, amount, apartment, and sub-account already exists in the ledger, it is flagged as a duplicate.

3. **Sub-Account Inflow & Outflow Allocation**:
   - Inflows ($\text{amount} > 0$):
     - Credited to the identified apartment ($\text{flatNum}$) and sub-account ($\text{targetAccount}$, defaulting to *Közös Költség* or *Felújítási Alap*).
     - Increases $\text{runningBalance}_{\text{flat}}$ and $\text{buildingReserve}_{\text{subAccount}}$:
       $$\Delta \text{FlatBalance} = +\text{amount}$$
       $$\Delta \text{Reserve}_{\text{subAccount}} = +\text{amount}$$
   - Outflows ($\text{amount} < 0$):
     - Recorded as a building expense ($\text{Expense}$) against the chosen sub-account fund.
     - Reduces $\text{buildingReserve}_{\text{subAccount}}$ without affecting individual apartment balances:
       $$\Delta \text{Reserve}_{\text{subAccount}} = -|\text{amount}|$$
       $$\Delta \text{FlatBalance} = 0$$

4. **Multi-Factor Scoring Engine for Apartment Matching**:
   $$\text{Score} = S_{\text{account}} + S_{\text{name}} + S_{\text{notice}} + S_{\text{amount}}$$
   where:
   - $S_{\text{account}} = 80$ if counterparty bank account matches known resident bank account.
   - $S_{\text{name}} = 65$ if counterparty name matches resident/owner name.
   - $S_{\text{notice}} \in [30, 55]$ if notice matches flat number pattern ("Fsz 2", "2. lakás", "ajtó 2").
   - $S_{\text{amount}} = 15$ if amount exactly equals the apartment's recurring monthly fee.
   - Items with $\text{Score} \ge 50$ without ambiguity are marked $\text{Verified}$ (ready for 1-click batch ledger entry); all other items are routed to the interactive Review Wizard.

---

## 11. OTP Bank Corporate API & mTLS Backend Integráció

### 11.1 Kölcsönös Tanúsítványos Hitelesítés (mTLS)
Az OTP Bank Corporate és Open Banking (PSD2) interfészei a legmagasabb szintű banki biztonsági szabványokat követik:
- **RSA 4096 bites kulcspár**: A privát kulcs (`otp_private.key`) és a 10 évig érvényes X.509 PEM tanúsítvány (`otp_cert.pem`) a `server/certs/` mappában található, mely a `.gitignore` szabályain keresztül szigorúan elzárt a verziókövetéstől.
- **Kölcsönös TLS (mTLS) kézfogás**: A kéréseket a Node.js `https.Agent` kezeli, szigorúan $\text{minVersion} = \text{TLSv1.2}$ és TLSv1.3 protokollokkal.

### 11.2 Szinkronizációs Folyamat és Végpontok
1. **`POST /api/bank/sync/:buildingId`**:
   - A frontend felületről kezdeményezett szinkronizáció meghívja a banki klienst az adott társasház IBAN azonosítójával és dátumszűrőivel.
   - Az API-ból érkező nyers tranzakciós objektumokat a `normalizeOtpTransaction()` egységesíti a TarsasApp könyvelési formátumára (különbséget téve `CRDT` befizetések és `DBIT` kiadások között).
   - A normalizált tételek automatikusan bekerülnek a Smart Matching és Review Wizard motorba.
2. **Környezeti változók**:
   - `.env.example` és `.env` fájlok konfigurálják az OTP API végpontokat (`OTP_API_BASE_URL`, `OTP_AUTH_URL`), `OTP_CLIENT_ID`, `OTP_CLIENT_SECRET`, és a tanúsítványok elérési útjait.



