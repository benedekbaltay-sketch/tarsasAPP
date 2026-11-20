# UI & UX Specifications

This document outlines the user interface structure, visual design tokens, interaction models, and modal specifications of the **Társasházkezelő Portál**.

---

## 1. Visual Design Tokens

The visual language emphasizes clarity, modern aesthetics, and financial transparency.

### 1.1 Color Palette
| Token Name | Value | Usage |
| :--- | :--- | :--- |
| **Brand Blue** | `#1E3A8A` | Primary branding, buttons, Common Cost (`KK`) badges, headers. |
| **Brand Blue Hover** | `#1E40AF` | Hover state for primary action buttons. |
| **Success Emerald** | `#16A34A` | Verified payments, positive monthly margins, overpayments. |
| **Danger Red** | `#DC2626` | Expenses, negative balances (arrears), delete actions. |
| **Purple Fund** | `#7C3AED` | Renovation Fund (`FA`) badges, indicators, and loans module. |
| **Background Body** | `#F3F4F6` | High-contrast cool light gray canvas background. |
| **Background Card** | `#FFFFFF` | Elevated pure white surface cards. |
| **Border Neutral** | `#E5E7EB` | Subtle structure borders. |

### 1.2 Typography Standard
- **Display Typography (`Outfit`)**: Used for numerical financial headers, KPI balance values, and bold dialog titles (`font-display`).
- **Body & Interface (`Inter`)**: Used for data tables, form inputs, navigation labels, and descriptions (`font-sans`).

### 1.3 Financial Status Badges
Every flat balance is labeled with an unmistakable status badge:
- **Hátralék / Arrears** (`balance < 0`): `bg-red-100 text-red-600 border border-red-200`
- **Rendezett / Settled** (`balance === 0`): `bg-blue-50 text-blue-700 border border-blue-200`
- **Túlfizetés / Overpaid** (`balance > 0`): `bg-emerald-100 text-emerald-700 border border-emerald-200`

### 1.4 Numeric Input Controls & Protection
- **No Spin Buttons / Steppers**: Globally hidden up/down arrows on all `<input type="number">` across all web browsers via `-webkit-outer-spin-button`, `-webkit-inner-spin-button`, and `-moz-appearance: textfield`.
- **Mouse Wheel Protection**: When hovering or focusing over numeric inputs, mouse wheel scrolling does not increment or decrement values (`blur()` dispatched on wheel event), preventing accidental financial modifications.

### 1.5 Transaction Amount Sign & Color Conventions
- **Positive Items (Payments & Inflows)**: Always displayed in green (`text-emerald-600`) with an explicit plus prefix (`+`, e.g. `+14 992 Ft`).
- **Negative Items (Expenses, Debits & Prescriptions)**: Always displayed in red (`text-red-600`) with an explicit minus prefix (`-`, e.g. `-14 992 Ft`, `-488 Ft`) across all transaction feeds and flat history tables.

### 1.6 Phone Number Formatting & Spacing Standard
- **Standard Formatting**: All Hungarian and international phone numbers entered across the system are automatically spaced and normalized:
  - Mobile numbers: `+36 XX XXX XXXX` (e.g. `+36 20 123 4567`, `+36 30 987 6543`, `+36 70 555 4321`)
  - Budapest landlines: `+36 1 XXX XXXX` (e.g. `+36 1 366 6666`)
  - Regional countryside landlines: `+36 XX XXX XXX` (e.g. `+36 52 123 456`)
- **Domestic Prefix Normalization**: Inputs starting with `06...` or domestic numbers without `+` prefix are automatically transformed into standard international `+36...` on input blur and saving.
- **Dialable `tel:` Links**: All call actions use clean international format without whitespace (e.g. `tel:+36201234567`) for 100% dialer compatibility across desktop and mobile devices.

### 1.7 Multi-Owner Management & Multiple Contact Details
- **Multiple Owners Support**: An apartment unit can have one or multiple co-owners recorded in both `AddFlatModal` and `EditFlatMasterModal`.
- **Conditional Ownership Share (`Tulajdoni arány`) Field**:
  - **Single Owner (`owners.length === 1`)**: The ownership share field is hidden (1 owner owns the unit 100% / 1/1).
  - **Multiple Owners (`owners.length > 1`)**: A dedicated **"Tulajdoni arány (opcionális)"** input field automatically appears for each co-owner (e.g. `1/2`, `50%`, `1/4`), allowing optional individual ratios.
- **Contact Details per Owner**:
  - Each owner/co-owner has exactly one email address and one phone number.
  - Formatted blur validation automatically formats phone numbers into the standard Hungarian spacing pattern (`+36 XX XXX XXXX`).
- **Dedicated Read-Only Cards**: `FlatDetailModal` and `EditFlatMasterModal` display dedicated badge cards for each co-owner showing their name, share badge, clickable `mailto:` link for their email, and dialable `tel:` link for their formatted phone number.

### 1.8 Multi-Flat Switching and Universal Header Profile Switcher
- **Seamless Apartment Switching**: Residents owning multiple apartments, or holding partial ownership shares across one or more flats (e.g., 100% in one unit and `1/2` share in another), can switch between their flats instantly.
- **Universal Top Header Placement (`ProfileSwitcherButton.jsx`)**:
  - The profile switcher (`[👥 Profilváltás]`) is prominently and consistently placed at the **top header** across all main views and modals (`Header.jsx`, `LoansModal.jsx`, `FlatsDataModal.jsx`, `ProfileModal.jsx`, `FinancialSituationModal.jsx`, `DocumentsModal.jsx`, `FullscreenTxModal.jsx`).
  - **Clean Resident Dashboard**: The bulky, redundant in-page apartment switcher bar ("Saját lakásaim") has been completely removed from `TenantView.jsx`. Apartment switching is centrally and elegantly accessible from the top header at all times, freeing up vertical space for financial and utility data.
  - **Removed from the Side Drawer**: The profile switching item is intentionally excluded from the 3-line side drawer (`IosSideDrawer.jsx`), keeping navigation menus purely focused on view sections while identity switching remains universally anchored at the very top.
  - **Mobile & Desktop Optimization**: On mobile devices, the profile switcher button is arranged cleanly with dedicated compact touch padding (`px-2.5 py-1.5`) and responsive layout, ensuring zero header overflow or clipping. In `FlatsDataModal`, the search bar moves to a second row on small screens to maintain a balanced, native app feel.
### 1.9 High-Resolution Image Rendering & Zero-Lag Lightbox Previews
- **Language Flag Switcher Resolution**: Country flags (`gb.svg` and `hu.svg`) are sized to crisp, balanced dimensions (`w-5 h-3.5 sm:w-6 sm:h-4` in `Header.jsx` and `LoginView.jsx`) with `loading="eager"`, delicate borders (`border-black/15`), and sub-pixel shadow, ensuring vivid detail without any network latency.
- **Brand Building Icon**: Scaled and sharpened across the application header and login portal with high-contrast background containers and crisp vector geometry.
- **Favicon Vector Geometry**: Enhanced with `shape-rendering="geometricPrecision"` in `public/favicon.svg` to eliminate pixel aliasing on Retina displays and modern browsers.
- **Attachment Image Thumbnails & Fullscreen Lightbox Modal**:
  - Whenever an image file (e.g. `.jpg`, `.jpeg`, `.png`, `.webp`) is attached to an incident claim, meter reading, or financial transaction, an instant high-resolution thumbnail preview appears instead of a generic document icon.
  - Clicking any thumbnail instantly opens a zero-latency **Fullscreen Lightbox Modal** displaying the image in full fidelity with a direct download button and backdrop-dismiss behavior. Since the image is already available in memory (Data URL), opening the preview requires **0 ms network overhead** and causes zero performance lag.

---

## 2. Main Views

### 2.1 Login View (`LoginView.jsx`)
- **Main Card**:
  - Centered brand icon and title.
  - Email input with `Mail` icon.
  - Password input with `Lock` icon and hold-to-peek `Eye` button.
  - "Remember Me" checkbox and primary "Bejelentkezés" button.
  - Footer links: "Elfelejtettem a jelszavam" and "Segítség és Kapcsolat".
- **Authentication Only (No Demo/Quick-Login Credentials)**:
  - Unauthenticated demo buttons and hardcoded credentials are strictly prohibited. All users (Common Representatives, SZVB, and Residents) must authenticate with their Firebase Auth email and password.

### 2.2 Resident Portal (`TenantView.jsx`)
- **Dynamic Account Grid (`allAccounts`)**:
  - Dynamically renders cards for all accounts associated with the building: base accounts (`KK`, `FA`) plus any custom sub-accounts/funds (`customBankAccounts`).
  - **Account Header**: Short name pill with thematic coloring (`#1E3A8A` for KK, purple for FA, emerald/custom for sub-accounts), full fund name, building address, and monthly fee prescription (when `hasMonthlyFee: true`).
  - **Single / Non-Redundant Arrears Display**: The current balance is shown in the balance box with its status badge (e.g. `Tartozás: 12 000 Ft` or `Rendezve`). The debt amount is never repeated redundantly in a separate box.
  - **Transfer Data Box**:
    - **When in arrears (`debt > 0`)**: Displays *„Átutalási adatok a hátralék rendezéséhez”* with a 1-click **[Adatok másolása]** button, Beneficiary, IBAN, and formatted Payment Reference (`[BuildingCode] [FlatNum]. lakas [Fund]`).
    - **When settled / overpaid (`debt === 0`)**: Displays *„Nincs hátralék”* / *„Túlfizetés”* banner plus bank transfer details for regular or advance payments.
- **Common Representative Quick Contact Card**:
  - Prominent banner placed at the very top.
  - Dynamically displays the building's configured Representative Name (`currentBuilding.repName`), direct phone call link (`tel:`) with copy action, and direct email link (`mailto:`) with copy action (no hardcoded personal details).
- **Combined Transactions Preview**:
  - Live search input (filters all items instantly without truncation).
  - SheetJS Excel export button.
  - 3 most recent items shown by default with inline expand/collapse toggle and dedicated Fullscreen History button.

### 2.3 Representative Dashboard (`AdminView.jsx`), Header & Side Drawer (`Header.jsx`, `IosSideDrawer.jsx`)
- **Clean Building Header & Navigation**:
  - When inside an active condominium, the top header (`Header.jsx` and `NavLogoButton.jsx`) displays the **active condominium's name** (`currentBuilding.name`) as the primary bold title instead of the generic application title (*„Közös Költség Nyilvántartó”*), paired with the user's role or flat number as a concise subtitle.
  - **No Green "Naprakész" Pill Inside Buildings**: `CloudSyncBadge` accepts `hideWhenSynced={isInBuilding}` so the green *"Naprakész"* / *"Up to date"* pill is hidden when inside a condominium (while real cloud sync errors still surface an amber retry alert, and the subtle 1px top progress bar in `App.jsx` shows active sync progress without shifting header controls).
  - **Unified Portfolio & Building Switcher Dropdown (`Header.jsx` & `BuildingSelectorModal.jsx`)**:
    - Replaces the static *"Társasházaim (Portfólió)"* button in `Header.jsx` with a single interactive dropdown button (**Társasházak / Condominiums**) for Common Representatives inside a building.
    - The dropdown offers (1) one-click return to **Társasházaim (Portfólió) / My Condos (Portfolio)** overview, and (2) a scrollable list of all managed condominiums with the active building marked (`Aktív` / `Active` + checkmark) for instant switching between managed buildings without returning to the portfolio page first.
    - Admin duplicate switching via `ProfileSwitcherButton` is suppressed in `Header.jsx` (residents with multiple flats continue seeing `[👥 Profilváltás]`), while `BuildingSelectorModal` (opened from fullscreen modals) also includes the matching Portfolio overview shortcut.
  - The redundant in-page blue context bar (`← Vissza a Társasházaimhoz`, `Aktív ház`, `Ház adatai & Bank`) has been removed from `AdminView.jsx`, and the redundant `← Vissza a Társasházaimhoz` button and `Aktív ház` card have been removed from the 3-line side drawer (`IosSideDrawer.jsx`).
  - **Ház adatai & Bank / Building Details & Bank** is placed directly as a dedicated menu item (`building-settings`) inside the building-specific 3-line side drawer (`IosSideDrawer.jsx`), opening `GlobalBalancesModal` cleanly for Admins.
- **Top Navigation Tabs**:
  - **Vezérlőpult (Dashboard)**: Core administrative dashboard (KPIs, Arrears Grid, Transactions).
  - **Közgyűlés (General Assembly)**: Dedicated section for generating official assembly financial statements and accounting packages.
- **Top KPI Row**:
  - **Card 1 (Folyószámlák és Tartalékok)**: Single unified edit pencil button (`Pencil`) opening `GlobalBalancesModal`. Dynamically displays KK, FA, and all custom account reserves.
  - **Card 2 (Összes Hátralék)**: Total Arrears across all apartments + "+ Új tétel rögzítése" universal entry button.
- **Monthly Balance Margin Card**:
  - Current month cashflow margin (+/-) with Inflow vs Outflow comparison.
- **Arrears Matrix (Lakások és Egyenlegek)**:
  - Responsive grid of apartment cards displaying KK, FA, and all dynamic custom account balances.
  - Red background highlight for any unit with an outstanding balance.
  - **Dynamic Quick-Pay Buttons**: Displays `+<ShortName>` (e.g. `+KK`, `+FA`, `+Megt`, `+LTP`) strictly for accounts where `acc.hasMonthlyFee === true`. The short name is fully configurable in the bank accounts editor. Accounts configured without monthly fees omit quick-pay buttons.
  - Inline Edit Mode: Reveals pencil (edit master flat) and trash (delete flat) buttons.
- **All Transactions & Expenses (`Minden tranzakció és kiadás`)**:
  - Searchable feed with vendor/flat names, account tags, amounts, and dates.
  - **Expense Naming Logic**: For deductions/expenses, the bold title displays the user-entered **comment** (e.g. *MVM*, *Zafiri és Társa Ügyvédi Iroda...*, *Időszakos költségek*) rather than repeating the source account ("Közös Költség"). The account is clearly indicated by the adjacent `[KK]` or `[FA]` badge.
  - **Subtitle Details**: Subtitles display the transaction date and expense category (e.g. `2026-08-13 • Közművek`) without redundant title duplication.
  - Shows the **8 most recent records by default** (expanded from 3 to prevent new items from immediately hiding previous month records); includes robust date parsing and secondary timestamp sorting (`Date.now()` ID) to guarantee newly created records appear at the top among equal dates.
  - "Összes tétel" button opens `FullscreenTxModal` for full window viewing, searching, and Excel export.
- **General Assembly Tab (`Közgyűlés`)**:
  - Clean, dedicated document library section with minimal clutter.
  - Primary document card: **Tulajdonosi egyenlegek elszámolása** with a **"Dokumentum generálása"** action button.
  - Opens `AssemblyModal` allowing rapid period selection (*„Előző teljes év”*, *„2026 aktuális év”*, or custom date boundaries).
  - Generates Tht.-compliant `.xlsx` reports with separate KK and FA rows per flat, clean alphanumeric unit names (`Fsz 1.`), and live dynamic Excel formulas for closing balances.

### 2.4 SuperAdmin Control Center (`SuperAdminView.jsx`)
- **Top Metric Cards**:
  - Displays total condominium representatives, total managed condominiums, total apartments, and total registered email addresses across the platform.
- **Visual Hierarchy Tree Diagram**:
  - **Level 1 (Representative / KK Root Node)**:
    - Displays Condominium Representative name, managed condominium title, and building address.
    - Clickable representative email address with 1-click clipboard copy button.
    - Representative phone with dialable link.
    - Direct **„Belépés KK-ként (Módosítás a profilján)”** action button for seamless act-as impersonation.
    - Branch expand/collapse arrow toggle with unit counts.
  - **Level 2 (Branching Apartment Nodes)**:
    - Connected via visual tree spine line (`border-l-2 border-indigo-200`).
    - Displays flat name/number, resident/owner names, and **all associated email addresses** (including co-owner emails and secondary email lists), each equipped with dedicated 1-click copy buttons.
    - Financial status badge (Settled, Arrears with amount, Overpaid with amount).
    - Quick actions: **„Törzsadatok”** (Master Data) and **„Belépés lakóként”** (act as resident).
- **Scalability and Filters**:
  - Handles any number of representatives and apartments via search filter (by KK, building, flat number, owner name, or email), Expand All / Collapse All buttons, and an alternative Tabular Matrix view.

### 2.5 Közvetlen Bejelentkezés & Szerepkör Felismerés
A bejelentkezés teljesen közvetlen, köztes választóképernyő nélkül működik:
- A felhasználó megadja az e-mail címét és jelszavát a `LoginView` felületén.
- A rendszer az e-mail címhez tartozó regisztrált profil alapján azonnal a megfelelő felületre irányít:
  - Közös Képviselői (`admin`) profil esetén: közvetlenül a társasházi vezérlőpult (`AdminView`) vagy portfólió (`PortfolioView`). Nincs lakásváltási gomb.
  - Lakói (`Owner`) profil esetén: közvetlenül a saját lakás felülete (`TenantView`). Nincs KK-váltási gomb.
  - Rendszergazda (`superadmin`) profil esetén: `SuperAdminView`.

### 2.6 Condominium Portfolio Dashboard ("Társasházaim" — `PortfolioView.jsx`)
Minimalista, nagyvállalati méretű (100+ társasház) áttekintő vezérlőpult a közös képviselő számára:
- **Kompakt fejléc-kártya**: Letisztult fehér kártya diszkrét szürke körvonallal (`border border-gray-200 shadow-xs`).
- **Fejléc melletti kompakt KPI jelvények**:
  - A korábban külön nagy kártyasorban lévő mutatók helyett közvetlenül a nagy **„Társasházaim”** cím mellett kaptak helyet diszkrét, kompakt jelvényként:
    - `[ 🏢 Kezelt társasház: N ]`
    - `[ 📑 Összes lakás: M ]`
  - Ezáltal a korábbi feleslegesen nagy függőleges helyet foglaló külön kártyablokk megszűnt.
- **Fejléc műveletek**:
  - **[ + Új társasház hozzáadása ]**: Új társasház regisztrálása névvel, címmel, adószámmal és kezdőtartalékokkal.
  - **[ 📅 Naptár ]**: Naptár és Feladatok modul megnyitása az összes kezelt házra összesítve (`'all'`).
- **Nézetváltó és Alapértelmezett Lista Nézet (`viewMode: 'list'`)**:
  - Nagyobb képviseleti cégek esetén (ahol akár 100+ társasházat kezelnek) a korábbi csempés rács nehezen volt átlátható.
  - **Alapértelmezett Lista Nézet**: Sűrű, elegáns, könnyen áttekinthető táblázat az alábbi oszlopokkal:
    1. *Társasház / Cím*: Épület ikon, félkövér név és alatta a pontos cím.
    2. *Adószám*: Monospace formátumú adószám badge.
    3. *Lakások*: Albetétek száma kék kapszulában.
    4. *Számlavezető*: A társasház bankja (OTP, K&H, stb.).
    5. *Tartalékok*: Összesített egyenleg zöld kiemeléssel, alatta KK és FA bontással.
    6. *Hátralék státusz*: Zöld „Rendezett” vagy piros hátralék összeg a tartozó lakások számával.
    7. *Műveletek*: „Megnyitás →” gomb, közvetlen Naptár és Házbeállítások gyorsgombok.
  - **Csempe nézet kapcsoló**: A felhasználó tetszés szerint átválthat a kártyás rácsnézetre (`[ ⊞ Csempe ]`).
- **Keresősáv**: Valós idejű szűrés a házak neve, címe vagy adószáma alapján.

### 2.7 Impersonation Banner (`ImpersonationBanner.jsx`)
- Pinned at the very top of the viewport (`sticky top-0 z-[90]`) with a prominent amber/gold visual banner whenever a SuperAdmin acts in the profile of a representative or resident.
- Clearly states: *„Rendszergazda Mód: Jelenleg [Név] profiljában dolgozik — [Ház Neve]”*.
- Features an immediate, 1-click **„← Visszalépés a Rendszergazda felületre”** escape button to return safely to `SuperAdminView` without lingering side effects.

---

## 3. iOS Side Drawer Navigation (`IosSideDrawer.jsx`)

The drawer menu slides in from the left edge with native 60fps performance:
- **GPU Acceleration**: Uses `transform: translate3d` / `translate-x` and `will-change: transform`.
- **Zero Filter Lag**: Avoids heavy full-screen `backdrop-filter: blur()` shaders, utilizing clean `bg-slate-900/50` opacity transitions to eliminate GPU rasterization bottlenecks.
- **Universal Availability (3-line Hamburger Menu ☰)**: The 3-line menu button is accessible across **all views and modal headers** on the left side of the logo.
- **Top Context Navigation**:
  - When inside an active building in KK mode, the drawer features a prominent top button: **"← Társasházaim (Portfólió)"** to immediately return to the multi-building overview.
- **Main Menu Items**:
  1. **Főmenü / Vezérlőpult** (`LayoutDashboard`)
  2. **Naptár és Feladatok** (`Calendar`) — Opens the Calendar & Tasks modal.
  3. **A ház pénzügyi helyzete** (`TrendingUp`)
  4. **Lakások adatai** (`Home`) — Admin only
  5. **Közgyűlés** (`FileText`) — Admin only
  6. **Hitelek** (`Landmark`)
  7. **Dokumentumok** (`FolderArchive`)
  8. **Profilom** (`User` / `Building`)
- **Direct Role Switcher Group**:
  - For dual-role accounts, includes dedicated switches: "Saját Lakásom" (with active flat number) and "Közös Képviselet".
- **Responsive Mobile & Touch Support**:
  - Full-height slide-in panel with dedicated top header and close button (`X`).
  - Tapping outside on the dimmed backdrop or pressing `Escape` closes the drawer immediately.

---

## 4. Modal Specifications

All modals render with strict multi-tier layering:
- **Tier 1 (`z-40`)**: Fullscreen views (*FlatsDataModal*, *FinancialSituationModal*, *DocumentsModal*, *LoansModal*, *ProfileModal*, *FullscreenTxModal*).
- **Tier 2 (`z-50`)**: Dialog modals (*FlatDetailModal*, *EditFlatMasterModal*, *UniversalTransactionModal*, *AssemblyModal*, *BuildingSelectorModal*, etc.).
- **Tier 3 (`z-60`)**: Confirmation & security dialogs (*DeleteFlatConfirmModal*, *QuickPayConfirmModal*, *ResetPassConfirmModal*, *AuthModals*).
- **Tier 4 (`z-[70]`)**: Global navigation drawer (*IosSideDrawer*).

| Modal Component | Trigger | Key Functionality |
| :--- | :--- | :--- |
| **`UniversalTransactionModal`** | Central "+ Új tétel rögzítése" button, or "Részletes űrlap..." | Consolidated universal transaction modal. **Type selector**: 🟢 Befizetés (+), 🔴 Kiadás (-), 🔵 Előírás / Terhelés. **Scope selector**: Teljes társasház (Közös tétel), Egy adott lakás, Több lakás kiválasztása (Multi-flat). In multi-flat mode: individual checkboxes, multiplier counters ($1\times, 2\times, 3\times$), base unit amount, and dynamic sum calculation ($\text{base} \times \text{multiplier}$). Includes bank impact toggle (*„Befolyásolja a folyószámla egyenleget?”*), 1-click exact 1-month fee quick-fill button (*„1 havi díj: X Ft”*), date, comment, and attachment uploads. |
| **`QuickPayConfirmModal`** | Clicking `+<ShortName>` (e.g. `+KK`, `+FA`, `+Megt`) on any flat card | Fast confirmation dialog for recording strictly **1 monthly prescribed fee** (evaluated via `getCurrentFee(flat, type)` independent of arrears). Displays target account with short name badge, exact amount, single-click "Befizetés (+)" action, and secondary "Részletes űrlap megnyitása..." link to open `UniversalTransactionModal`. |
| **`AssemblyModal`** | Közgyűlés tab -> "Dokumentum generálása" | General Assembly accounting and report generator. Features period quick-selectors (*„Előző teljes év”*, *„2026 aktuális év”*, or custom dates), generates Tht.-compliant balance sheets, and exports structured Excel files with live dynamic formulas. |
| **`FlatDetailModal`** | Clicking any flat card | Shows latest transactions, resident identity, inline monthly fee and balance modification for KK, FA, and all custom accounts, zero horizontal overflow (mobile card-rows + desktop fixed table), full item editing & deleting, single prominent [Teljes előzmény] button, [Új tétel], [Ceruza] edit button, and [X] close button with automatic draft discard, edit-mode reset, and background body scroll lock. |
| **`EditTransactionModal`** | Double-click on transaction row or Pencil action | Opens the read-only "Tétel adatai" / "Havi előírás adatai" card view with formatted amount, fund badge, date, category, flat/payee, comment, and attachments. Includes a "Szerkesztés" (Pencil) button to switch into edit mode for updating amount, target account (KK, FA, or custom funds), comment, category, and date. Cancelling or closing reverts to read-only mode and discards uncommitted drafts. |
| **`GlobalBalancesModal`** | Pencil on building reserves | Direct entry of current bank account balances with automatic baseline calibration for KK, FA, and dynamic custom accounts. Includes inline form to add new sub-accounts/funds with configurable short names and monthly fee prescription toggles. |
| **`AddFlatModal`** | "Új lakás" in edit mode | Creates a unit with single or multiple owners (`owners: []`), conditional ownership share (only if > 1 owner), automatic phone formatting, fees, ownership share %, area, terrace, multiple garages (`garages: []`), and multiple storage rooms (`storages: []`). |
| **`EditFlatMasterModal`** | Pencil on flat master | Two modes (Read-only card vs Edit form); multi-owner editor with "+ Új tulajdonos" and conditional ownership share input, formatted phone numbers, garage and storage list management, password reset, [Ceruza] edit button, [X] close button, backdrop click handler, uncommitted draft discard, and background body scroll lock. |
| **`FlatsDataModal`** | Menu -> "Lakások adatai" | Fullscreen directory of all apartments in the building. Clicking any flat card automatically opens the Master Data view (`EditFlatMasterModal`). The bottom of each card features a prominent, highlighted "Törzsadatok" action button, while the financial statement link ("Pénzügyi adat") is placed subtly in the top-right corner. Features formatted phone display, multi-owner search matching, header profile switcher, and 3-line menu button. |
| **`FinancialSituationModal`**| Menu -> "A ház pénzügyi helyzete" | Fullscreen financial overview: building reserves, 3-month performance table with interactive monthly drill-down (**double-click or Enter** opens `MonthlyDetailModal`), **Nyilvános tartozástérkép** with view switcher (**Előző hó zárása** vs **Aktuális élő állapot**), detailed data specification & methodology explainer card, flat breakdown showing KK and FA sub-balances, header profile switcher, and 3-line menu button. |
| **`MonthlyDetailModal`** | Double-click or Enter on any row in the 3-month performance table | Detailed monthly ledger modal (`z-[55]`). Displays strictly real bank payments and expenses that affected the bank accounts (`számlafőösszeget valóban befolyásolták`), omitting technical accounting debits/assessments (`manualDebits` are excluded). Shows KPI summary (Inflow, Outflow, Margin), instant search, type filters (All, Income, Expense), account filter, and attachment downloads. Only the top `X` close button is present (bottom close button removed). **Permissions**: Residents have clean read-only access (no edit/delete buttons, no redundant notice banner); Managers (KK / Admin) can click the "Szerkesztés" button on any item to open `EditTransactionModal` (`z-[75]`) for instant in-place modifications. |
| **`DocumentsModal`** | Menu -> "Dokumentumok" | Fullscreen Windows 11 File Explorer-style condominium document repository & nested folder network (`docFolders` with arbitrary `parentId` hierarchy). **Windows 11 Minimalist Command Bar**: `(+) Új ▾` dropdown (strictly *Mappa / Folder* and *Dokumentum / Document*) separated by a divider from crisp two-tone Windows 11 icon actions (**Kivágás / Cut**, **Másolás / Copy**, **Beillesztés / Paste**, **Átnevezés / Rename `[A|]`**, **Letöltés / Download**, **Törlés / Delete**), with no secondary clipboard banner below the toolbar, no Move button, and no in-place file content replacement (uploaded files are immutable like OS files). **In-App Preview (`DocumentPreviewModal`)**: fast double-click or `Enter` on any document opens a zero-download in-app preview supporting **PDF** (magic-byte verified `blob:` iframe), **Images** (zoomable JPG/PNG/WEBP), **Excel `.xlsx`** (multi-sheet interactive table via `read-excel-file/universal`), and **Word `.docx`** (safe XML paragraph reader), plus an explicit Download button if the user wants a local copy. **Unified List & Large Icons Views**: folders and documents share identical unified rows in **List / Details view** and matching large-icon tiles in **Large Icons view**. **Full Explorer Interactions (Admin)**: external drag & drop multi-file upload (magic-byte & 2 MB guarded via `fileSecurity.js`), internal drag & drop move onto folders/breadcrumbs (cycle-safe), single/multi/range selection (`Click`, `Ctrl+Click`, `Shift+Click`, `Ctrl+A`), clipboard copy/cut/paste (`Ctrl+C`, `Ctrl+X`, `Ctrl+V` with bottom-right toast feedback and deep recursive cloning), slow 2nd-click inline renaming & `F2` rename, `Delete` key confirmation (`Enter` confirm / `Esc` cancel), and right-click context menus. |
| **`LoansModal`** | Menu -> "Hitelek" | Fullscreen placeholder explaining the upcoming loans module, with header profile switcher and 3-line menu button. |
| **`ProfileModal`** | Menu -> "Profilom" / "Lakásom" / "Lakásaim" | Role-adaptive profile. Resident: personalized master card and read-only contact information by default with explicit "Szerkesztés" toggle. Representative: condominium master data (**Társasház elnevezése** and **Adószám**) management, representative contact details, dedicated **Bankszámlák és Utalási Adatok** card for managing beneficiary, IBAN, bank name for KK, FA, and adding/modifying/deleting dynamic sub-accounts/funds with conditional monthly fee setting (`hasMonthlyFee`), and **Custom Tile System** (`RepresentativeSections.jsx`) with collapsible accordion case items, 1-click clipboard copy, Lightbox previews, header profile switcher, and 3-line menu button. |
| **`CalendarModal`** | Menu -> "Naptár és Feladatok", or Portfolio -> "Összesített Naptár" / "Naptár" | Fullscreen Calendar & Tasks module. **Month Grid View**: 7-day Monday-start grid with previous/next month navigation, "Ma" (Today) jump, day cells with event count indicators and colored event pills, click-to-inspect day panel with "+ Esemény erre a napra" quick addition. **Tasks & Deadlines View**: interactive checklist with completion checkboxes (`isDone`), priority badges (High, Medium, Low), category color tags (Közgyűlés, Pénzügyi, Karbantartás, Feladat, Egyéb), building filter badges, and full edit/delete actions. Includes embedded modal for adding and editing events with time, category, priority, building target, location, and description. |
| **`BuildingSelectorModal`** | Profile button in header | Switch active condominium or user profile; contains admin button to add new building. |
| **`AddBuildingModal`** | "Új társasház hozzáadása" | Creates a new condominium with bank accounts, initial funds, and condominium tax number (`taxNumber`). |
| **`FullscreenTxModal`** | "Összes tétel" / "Teljes előzmény" | Fullscreen ledger table with date/comment/amount search, Excel export, and back navigation. Edit mode (`isEditMode`) automatically resets to read-only upon back navigation, modal close, or clicking an individual transaction edit pencil. |
| **`SmartMobilePayModal`** | "Hátralék fizetése" button in `TenantView`, or URL query parameter `?pay=1` | Streamlined Minimalist qvik QR Code Modal. Focuses purely on instant, friction-free payment via mobile banking. Displays condominium name, flat number, fund badge, exact outstanding debt in HUF, the official high-contrast MNB qvik instant payment QR code for in-app scanning with 100% automated form pre-fill, scanning instructions, and subtle IBAN copy link. |
| **`ConfirmModals`** | Delete / Quick pay triggers | In-app confirmation dialogs for flat deletion, transaction deletion, document deletion, and quick pay. Replaces standard browser alerts. |
| **`AuthModals`** | Login / Profile triggers | Forgot password, reset password via deep-link token, and change password dialogs. |

---

## 5. Universal Edit Mode & Discard Specifications

To guarantee a predictable and reliable user experience, every editable interface strictly adheres to the following principles:

1. **Explicit Edit Activation**:
   - Views and contact records load in a **clean, read-only state** by default.
   - Modifying inputs requires an explicit user action (clicking a "Szerkesztés" / pencil button).
   - Prevents accidental overwrites or inadvertent changes while browsing.

2. **Zero Lingering Edit Mode on Exit**:
   - Whenever an edit screen or modal is closed—whether by clicking the back arrow (`←`), the close button (`X`), the backdrop overlay, or the cancel button (`Mégse`)—the system **discards all unsaved inputs** and **fully terminates edit mode**.
   - Returning to the view requires the user to explicitly initiate edit mode again.

3. **Applied Component Behaviors**:
   - **`FullscreenTxModal` ("Összes tétel")**: Turning on list edit mode and subsequently clicking `←` or opening an individual transaction's edit modal resets the list's `isEditMode` to `false`.
   - **`RepresentativeSections.jsx`**: Exiting a tile detail view (via `←`, `X`, or backdrop) resets tile edit mode, quick info editing, note editing, custom field editing, item modal, linking modal, and collapses all case items back to their default compact header-only state. Opening any tile automatically starts with all cases closed.
   - **`ProfileModal.jsx` (Building Master Data & Contact Details)**: Building master data (**Társasház elnevezése** and **Adószám**) on the Representative profile and resident contact details (**phone**, **emergency contact**, **tenant notes**) render in read-only cards with quick clipboard copy. Inputs appear only when clicking "Szerkesztés". Cancelling or closing the modal discards drafts and restores original data.
   - **`EditFlatMasterModal.jsx`**: Master data remains read-only until the pencil icon is clicked. Exiting or clicking "Mégse" restores original values from the database and returns to read-only mode.
   - **`EditTransactionModal.jsx`**: Opens in a clean, read-only item details view by default. Clicking the pencil button switches to edit mode. Cancelling or closing discards changes and resets to read-only view.
   - **`TransactionModal.jsx`**: Dismissing the modal resets all form state and file attachments.

---

## 6. Professional Modal Scroll Architecture & Double Scrollbar Prevention

To maintain a clean, native, high-end desktop and mobile experience and prevent duplicate or decoupled scrollbars:

1. **Synchronized Root Viewport Scroll Lock**:
   - Whenever any modal, drawer, or dialog is active (`isAnyModalOpen`), both `document.body.style.overflow = 'hidden'` and `document.documentElement.style.overflow = 'hidden'` are activated in tandem.
   - This eliminates root document scrollbars in desktop browsers (Windows Chrome/Edge/Firefox), preventing the background dashboard and main navigation from scrolling or showing a ghost scrollbar behind open modals.

2. **Full-Width Outer Scroll Containers**:
   - All fullscreen modal views (`ProfileModal`, `FlatsDataModal`, `FinancialSituationModal`, `DocumentsModal`, `FullscreenTxModal`) strictly separate the scroll container from the content width constraint.
   - The scroll container occupies full viewport width (`flex-1 overflow-y-auto w-full overscroll-contain`), docking the scrollbar naturally at the right window edge.
   - Layout width limits (`max-w-4xl mx-auto`, `max-w-6xl mx-auto`) are applied exclusively to the inner child content container, preventing awkward detached or floating scrollbars in the middle of wide desktop displays.

3. **Chained Scroll Containment**:
   - Modal backdrops, tile overlays, and dialogs implement CSS `overscroll-contain` to trap wheel and touch scrolling within the active container, preventing scroll leakage to background layers.

---

## 7. Standardized 3-Column Modal Header Architecture (`NavLogoButton`)

All fullscreen modal views (`ProfileModal`, `FlatsDataModal`, `FinancialSituationModal`, `DocumentsModal`, `LoansModal`, and `FullscreenTxModal`) feature an identical, symmetrical 3-column sticky header layout:

```
[ Left (flex-1 justify-start) ]        [ Center (flex-shrink-0 text-center) ]        [ Right (flex-1 justify-end) ]
[ 🏢 NavLogoButton (Főmenü)   ]        [ [Icon] Aktív menüpont címe         ]        [ [Profilváltás] [☰ Menü]    ]
```

1. **Left Column — Official Website Brand Logo (`NavLogoButton.jsx`)**:
   - Anchored at the top-left corner across every fullscreen modal.
   - Contains the official `#1E3A8A` blue logo badge with the condominium vector icon and responsive text (`Társasházkezelő`, `← Főmenü` / `← Back to Home`).
   - Clicking this logo immediately closes the modal and returns the user directly back to the main dashboard / home screen (`handleClose` / `onClose`).
2. **Center Column — Active Interface Title & Icon**:
   - Symmetrically and mathematically centered in the viewport between the two flexible outer columns (`flex-1 justify-start` and `flex-1 justify-end`).
   - Displays the dedicated icon inside a tinted rounded container and the bold view title:
     - `ProfileModal`: `ProfileIcon` + **"Profilom"** / **"Lakásom"**
     - `FlatsDataModal`: `Home` + **"Lakások adatai"**
     - `FinancialSituationModal`: `LineChart` + **"A ház pénzügyi helyzete"**
     - `DocumentsModal`: `FolderOpen` + **"Dokumentumok"**
     - `LoansModal`: `Landmark` + **"Hitelek"**
     - `FullscreenTxModal`: `Receipt` + **"Teljes könyvelési lista"** / **"lakás előzményei"**
   - Subtitle displays contextual metadata (e.g. resident name, closing date, flat count, or record count).
3. **Right Column — Navigation & Action Tools**:
   - Universal `ProfileSwitcherButton` and 3-line hamburger `Menu` drawer trigger (or contextual actions like Edit and Excel download in `FullscreenTxModal`).

---

## 8. Internationalization (i18n)

The interface is completely bilingual (Hungarian and English):
- Dictionary located in [`src/constants/translations.js`](file:///c:/Users/bened/Documents/tarsasAPP/src/constants/translations.js).
- Language flag button in the header toggles `state.currentLang` (`hu` / `en`).
- All headings, table headers, error messages, toast alerts, buttons, and helper tooltips dynamically resolve via `t[key]`.

---

## 9. SuperAdmin Impersonation Banner & Zero-Lag Return Architecture

### 9.1 Impersonation Banner Placement & Non-Overlapping Layout
- **Container Structure**: `ImpersonationBanner` is directly nested inside the sticky top header wrapper in `Header.jsx` (`<div className="sticky top-0 z-30 w-full shadow-sm">`) and inside each fullscreen modal (`<div className="sticky top-0 z-10 w-full shadow-xs">`).
- **Non-Overlapping Flow**: The banner sits strictly above the white header row in standard document flow (`w-full bg-gradient-to-r ... select-none animate-fadeIn`). As the user scrolls, both the banner and the website header stick together. The website logo, building address, titles, profile switcher, and menu button are **100% visible and unblocked at all times**.
- **Context Details**: Clearly shows the active user being impersonated, their role/flat, condominium name, and an unmistakable amber accent.

### 9.2 Zero-Lag Immediate Return from Any View
- **Immediate Modal Closure**: Clicking "[← Visszalépés a Rendszergazda felületre]" from the banner or drawer triggers `onExit()` and `exitImpersonation()`.
- **Reactive State Cleanup**: `App.jsx` reacts via `useEffect` to `currentUser?.role === 'superadmin' && !state.impersonatedFrom` to immediately invoke `closeAllModals()`.
- **Direct View Restoration**: The user lands directly onto the SuperAdmin tree hierarchy diagram view without needing to manually close any modals or navigate back to the main menu first.

---

## 10. General Assembly Module (`AssemblyModal.jsx`) & Owner Balances Statement

### 10.1 Access Points
- **Side Drawer**: Available for the Representative (`currentUser.role === 'admin'`) in `IosSideDrawer.jsx` with dedicated `FileSpreadsheet` icon.
- **Admin Dashboard**: Prominently accessible from the Arrears Matrix header in `AdminView.jsx`.

### 10.2 Month-Based Interval Selector & Default Behavior
- **Full-Month Selection**: The user selects `startMonth` (`YYYY-MM`) and `endMonth` (`YYYY-MM`).
- **Exact Date Boundaries**: Queries start on day 1 00:00 of the start month through the last day 23:59 of the end month.
- **Prescription Inclusivity**: Monthly prescriptions for both start and end months are fully calculated and included.
- **Dynamic Default Period**: Defaults to the entire preceding calendar year (`[Current Year - 1].01.01 – [Current Year - 1].12.31`).
- **Quick Presets**: 1-click presets for Preceding Year, Current Year, and Semi-annual periods (H1, H2).

### 10.3 Hungarian Condominium Act (Tht.) Strict Formula & 14-Column Structure
- **Formula**:
  `Záró egyenleg = Nyitó egyenleg - Időszaki előírás + Időszaki befizetés`
  (tartozás: negatív `-`, túlfizetés: pozitív `+`).
- **Column Breakdown**:
  1. `Albetét / Lakás megnevezése` (pl. "Fsz 1. lakás", plus garage/storage annexes if present)
  2. `Tulajdonos(ok) neve`
  3. `Nyitó egyenleg: Üzemeltetés (KK) (Ft)`
  4. `Nyitó egyenleg: Felújítási alap (FA) (Ft)`
  5. `Nyitó egyenleg: Összesen (Ft)`
  6. `Időszaki előírás: Üzemeltetés (KK) (Ft)`
  7. `Időszaki előírás: Felújítási alap (FA) (Ft)`
  8. `Időszaki előírás: Összesen (Ft)`
  9. `Időszaki befizetés: Üzemeltetés (KK) (Ft)`
  10. `Időszaki befizetés: Felújítási alap (FA) (Ft)`
  11. `Időszaki befizetés: Összesen (Ft)`
  12. `Záró egyenleg: Üzemeltetés (KK) (Ft)`
  13. `Záró egyenleg: Felújítási alap (FA) (Ft)`
  14. `Záró egyenleg: Összesen (Ft)`
- **Summary Row**: "ÖSSZESEN" bottom row summing all 12 financial columns.
- **Export Format**: Downloadable formatted `.xlsx` spreadsheet named `Tulajdonosi_egyenlegek_[KezdőDátum]_[ZáróDátum].xlsx`.
- **Future Assembly Documents**: Placeholders for Annual Financial Closing Report, Next Year Budget Proposal, and Attendance Sheet.

---

## 11. Modal Backdrop & Click-Dismiss Interaction Standard (`useBackdropClose`)

### 11.1 Backdrop Interaction & Accidental Close Prevention
- **Accidental Close Protection**: When users select text, drag content, or right-click inside a modal or dialog box and release the mouse outside the modal boundary on the backdrop, the modal **must not close**.
- **Two-Point Origin Verification**: Modals only close if **both** the initial `mousedown` (left click) and the subsequent `click` / `mouseup` events originated directly on the backdrop container itself (`e.target === e.currentTarget && e.button === 0`).
- **Hook Placement & React Rules of Hooks Integrity**: In all modal components (`FullscreenTxModal`, `FlatDetailModal`, `EditFlatMasterModal`, `AddBuildingModal`, `AddFlatModal`, `BuildingSelectorModal`, `EditTransactionModal`, `GlobalBalancesModal`, `UniversalTransactionModal`), all hooks (`useState`, `useEffect`, `useMemo`, `useBackdropClose`) are called **unconditionally at the top level** before any conditional logic or early `return null` statements, preventing hook count mismatches (React invariant error #310).

### 11.2 In-Progress Draft Retention & Background Wake Resilience
- **Persistent Uncommitted Inputs**: When a user inputs data in a modal (e.g. `UniversalTransactionModal`, `EditTransactionModal`, `EditFlatMasterModal`) and temporarily switches windows or applications (e.g. to copy amounts from an e-banking portal or email), returning to the browser **never resets or wipes typed inputs**.
- **Open State Transition Guards**: Modal initialization effects track opening transitions (`prevIsOpenRef`, `prevInitKeyRef`) and only initialize when the modal opens or a different item is explicitly opened, preventing re-renders from clearing user drafts.
- **Throttled Tab Wake & Smart State Merging**: Window `focus` and `visibilitychange` wake calls in `AppContext` are throttled (2.5s) and perform equality checks against the current revision/timestamp, avoiding redundant state mutations and spurious component re-renders when nothing changed in the cloud.

---

### 11.3 Transaction Keyboard Copy & Paste (`Ctrl+C` / `Ctrl+V`) and Arrow Navigation
- **Universal Availability**: Supported in the Main Admin Dashboard transaction list (`AdminView`), the Fullscreen Transaction Modal (`FullscreenTxModal`), and the Flat Detail Modal timeline (`FlatDetailModal`).
- **Row Selection & Subtle Visual Indicator**:
  - Clicking any transaction row selects it, highlighted with a clean, subtle light-blue background tint (`bg-blue-50/70`) without any harsh borders, rings, intrusive text badges, or row-level action clutter.
  - Keyboard shortcuts (`Ctrl+C` / `Ctrl+V`) operate directly on the selected row, with no intrusive buttons or indicators cluttering the fullscreen header.
- **Click-Outside Deselection**:
  - Clicking anywhere outside a transaction row (on empty modal areas, backdrop, filter panels, or outside headers) automatically clears the active selection.
- **Arrow Key Navigation**:
  - `ArrowUp` and `ArrowDown` navigate seamlessly through the filtered transaction list, updating the active selection.
- **Faithful Excel-style Duplication (`Ctrl+V`)**:
  - Pressing `Ctrl+V` immediately inserts the duplicate into the list:
    - **Date, amount, account (KK/FA), method, and status exactly match** the original copied transaction.
    - **Name / comment** receives the discrete suffix `(másolat)` (e.g. "Közös Költség (másolat)").
  - Supports Payments (`Transaction`), Expenses (`Expense`), and Prescriptions/Debits (`Debit`).
- **Context Awareness**:
  - If pasted inside a specific flat's detail modal or flat-filtered timeline, the copied transaction is automatically bound to that flat (`flatNum`).
  - If pasted in the global view or dashboard, the transaction preserves its original categorization and target account.
- **Safety & Reversibility (Undo)**:
  - Every duplication displays a confirmation toast notification with a 6-second **"Visszavonás" (Undo)** button that immediately deletes the newly created duplicate if clicked.
- **Form Focus Protection**:
  - Shortcut handlers strictly bypass execution if focus is inside an `<input>`, `<textarea>`, or contentEditable element, or if the user has selected arbitrary text on the page (`window.getSelection().length > 0`), ensuring zero interference with standard text editing.

---

### 11.4 Transaction Double-Click Details & Edit Mode Toggle (`onDoubleClick` vs Pencil Button)
- **Universal Double-Click Trigger (Read-Only Details View)**:
  - Double-clicking (`onDoubleClick`) any transaction or timeline row across the Main Admin Dashboard (`AdminView`), Fullscreen Transaction Modal (`FullscreenTxModal`), and Flat Detail Modal (`FlatDetailModal` - both desktop table and mobile card rows) opens the item in the read-only view ("Tétel adatai" / "Havi előírás adatai").
  - Displays formatted amount, source fund (`KK` / `FA`), date, category, flat/payee, comment, bank balance impact, and attachments.
- **Direct Edit Mode via Row Pencil Button**:
  - Clicking the "Szerkesztés" (Pencil) button on any item row directly opens the modal in **Edit Mode** (`initialEditMode = true`), immediately presenting the editable form fields ("Tétel módosítása" / "Havi előírás módosítása") without requiring an extra click.
- **In-Modal Mode Toggling & Discard**:
  - While in the read-only details view, clicking the "Szerkesztés" button switches into Edit Mode.
  - While in Edit Mode, clicking "Mégse" (Cancel) restores original values and returns to the read-only view. Closing the modal terminates edit mode and discards drafts.

---

### 11.5 Word-Style In-Row Text Selection & Native Clipboard Operations (`select-text cursor-text`)
- **Direct Text Selection Without Opening**:
  - Across all transaction feeds (`AdminView`, `FullscreenTxModal`, `FlatDetailModal`), rows support full text selection (`select-text`) without opening the item's details modal.
  - Users can highlight any arbitrary text (vendor/payee name, comment, date, category, amount, running balance) with mouse drag, exactly like in Microsoft Word.
- **Visual Affordance (`cursor-text`)**:
  - Hovering over textual elements displays the native text selection I-beam cursor (`cursor-text`), providing immediate feedback that any text can be selected.
- **Drag vs Row Selection Disambiguation**:
  - When the user drags to select text (`window.getSelection().toString().trim().length > 0`), row `onClick` and outside-click handlers bypass execution. This prevents state updates and React re-renders from collapsing the user's active highlight.
- **Native Clipboard Copy & Paste**:
  - Pressing `Ctrl+C` with text highlighted lets the browser natively copy the exact highlighted characters/words to the OS clipboard.

---

### 11.6 Professional & Minimalist Transaction Filtering Engine (`TransactionFilterBar.jsx` & `filterUtils.js`)
- **Always-Visible Active Filter Pills**:
  - Whenever any filter is active (`activeCount > 0`), the UI renders a slim, non-intrusive active pill bar above the transaction list even if the filter drawer is collapsed.
  - Active pills display formatted criteria with individual removal `✕` buttons:
    - 🏷️ **Típus (Type)**: `Csak bevételek` (emerald) vs `Csak kiadások` (rose) / `Csak befizetések` vs `Csak előírások`.
    - 🏦 **Számla (Account)**: `Közös Költség (KK)` (blue) vs `Felújítási Alap (FA)` (purple).
    - 📅 **Időszak (Period)**: `Ez a hónap`, `Elmúlt 30 nap`, `Elmúlt 3 hó`, `Idei év`, vagy egyedi intervallum (`YYYY-MM-DD – YYYY-MM-DD`).
    - 💰 **Összeg (Amount)**: `≥ 20 000 Ft`, `20 000 – 50 000 Ft`, etc.
  - Includes a one-click **"Minden szűrő törlése" (Clear all)** button and a live matching counter (e.g. `14 találat`).
- **Expanded Minimalist Control Drawer**:
  - **Segmented Type Control**: 3-state pill toggle (`Mind`, `Bevételek / Befizetések`, `Kiadások / Előírások`) with semantic color accents and directional arrow icons (`ArrowDownLeft`, `ArrowUpRight`).
  - **Segmented Account Control**: 3-state pill toggle (`Mind`, `KK`, `FA`) with colored indicator dots.
  - **1-Click Period Presets**: `Összes`, `Ez a hónap`, `Elmúlt 30 nap`, `Elmúlt 3 hó`, `Idei év`, és `Egyedi dátum` zökkenőmentes lenyíló naptárválasztóval.
  - **Minimalist Amount Range**: Gyorsgombok (`Bármennyi`, `< 20k Ft`, `20k-50k Ft`, `> 50k Ft`) és tiszta numerikus beviteli mezők `Ft` jelöléssel és azonnali törlési lehetőséggel.
  - **Multi-View Compatibility**: Megjelenik az `AdminView`-ban, a `TenantView`-ban, a `FlatDetailModal`-ban és a `FullscreenTxModal`-ban, teljesen kétnyelvű (`hu` / `en`) támogatással.
  - Pressing `Ctrl+V` in any input field, modal form, search bar, or external application (Word, Excel, email) pastes the copied text seamlessly.

---

### 11.6 Keyboard Delete Key & Reversible Undo for Item Deletion (`Delete` key & `DeleteTxConfirmModal`)
- **Keyboard `Delete` Key Trigger**:
  - In `AdminView`, `FullscreenTxModal`, and `FlatDetailModal`, pressing the `Delete` key on any active row selection (single-click selected row) immediately opens `DeleteTxConfirmModal`.
  - Strictly bypassed if focus is inside an `<input>`, `<textarea>`, or contentEditable element, or if the user has highlighted arbitrary text with the cursor.
- **Safety Confirmation Dialog**:
  - `DeleteTxConfirmModal` displays a confirmation prompt.
  - Supports `Enter` to confirm deletion and `Escape` or backdrop click to cancel.
- **Reversible Undo Action**:
  - Upon confirming deletion, the item is removed from state and tombstoned in the permanent vault, while a toast notification appears with a 5.5-second **"Visszavonás" (Undo)** button.
  - Clicking "Visszavonás" completely restores the deleted transaction, expense, or manual debit (and untombstones its ID from the vault), returning the ledger to its exact previous state.

---

### 11.7 Multi-Collection Item Resolution & State Sanitation (`EditTransactionModal`)
- **Universal Multi-Collection Fallback**:
  - `EditTransactionModal` employs a robust 3-tier lookup (`expenses`, `manualDebits`, `transactions`, and flat timelines via `flatNum` hint or flat-by-flat search).
  - Eliminates type mismatch anomalies where items copied or saved across differing collections (e.g. copied debits, manual entries, generated prescriptions) previously failed strict collection-by-type matching.
- **Form State Sanitation & Stale Data Prevention**:
  - On opening or switching items, if the requested entity is pending or resolving, form state (`date`, `amount`, `targetAccount`, `category`, `comment`, `includeInBalance`) is proactively wiped clean.
  - Guarantees that stale data from previously viewed items (e.g., an earlier month or a previous transaction) is never erroneously displayed.
- **Dynamic Type & Sign Inference**:
  - Dynamically calculates `effectiveItemType` (`Expense`, `Debit`, or `Payment`).
  - Corrects sign rendering in read-only details: debits (`Debit`), monthly prescriptions (`d-`), and expenses consistently display negative signs (`-`) in red, while payments display positive signs (`+`) in emerald green.
  - Dynamically switches category selectors and labels between *Kiadási kategória* (Expense Category), *Előírás kategória* (Debit Category), and *Befizetés módja* (Payment Method).
- **Safe Persistence**:
  - `editItem` dynamically checks which collection the target entity actually resides in before persisting, and receives `flatNumHint` to reliably match timeline cancellations.

---

### 11.8 Zero-Amount Assessment / Debit UX (`0 Ft Előírás / Terhelés`)
- **Input Validation & Form Submission**:
  - The single-flat and multi-flat debit inputs in `UniversalTransactionModal.jsx` allow setting `0` as the amount, with submit buttons remaining active when amount is `0` or `"0"`.
  - In `EditTransactionModal.jsx`, editing an assessment to `0` is fully supported, with `min="0"` on the number input.
- **Visual Presentation**:
  - Across all ledger views (`FlatDetailModal`, `FullscreenTxModal`, `AdminView`, `TenantView`, and `EditTransactionModal`), items with `0 Ft` are presented with clean, neutral styling:
    - Amount text renders without `+` or `-` prefix: `0 Ft`.
    - Text color is neutral dark gray (`text-gray-700`) rather than red or green.
    - Transaction icons display a subtle neutral minus icon (`Minus`) on light gray background.
  - Search queries searching for `"0"` match 0 Ft transactions correctly.

---

### 11.9 Minimalist Official MNB qvik Payment Modal (`SmartMobilePayModal.jsx`)
- **Streamlined Minimalist Architecture**:
  - Eliminates auxiliary tutorial cards to present a clean, high-contrast, distraction-free payment experience focusing purely on the QR code and instant execution.
- **Official High-Resolution qvik Logo & Badge**:
  - Incorporates the authentic 1024px official Hungarian qvik branding (`/qvik-logo.png`) on pure white background with crisp native typography for the *"Azonnali fizetés"* / *"Instant Payment"* lockup in navy `#25326D`.
- **Pure QR Code & Direct Bank Details**:
  - Centered high-contrast QR code (`QRCodeSVG`, size 215) containing the standard MNB/qvik payment payload.
  - Direct wire transfer card below the QR code presenting IBAN, beneficiary name, and structured payment comment with a 1-click **"Összes adat másolása"** copy package button.
- **Clean Dashboard Trigger Buttons & Visibility Control (`TenantView.jsx`)**:
  - The payment action button is toggled via `SHOW_QVIK_PAY_BUTTON = false` while aggregator contracting is in progress.
  - Residents see their debt amount alongside the standard copyable IBAN transfer details.
- **Background Scroll Locking & Pinned Sticky Header**:
  - Modal overlay enforces `overflow: hidden` on both `document.body` and `document.documentElement` to prevent background scrolling when open.
  - The modal header bar is pinned with `sticky top-0 z-10 flex-shrink-0` inside a `max-h-[92vh] flex flex-col` container, guaranteeing full visibility on mobile devices.

---

### 11.10 Universal Full-Aspect Transaction Editing & Inter-Account Transfers (`EditTransactionModal` & `UniversalTransactionModal`)
- **Comprehensive Item Editing (`EditTransactionModal.jsx`)**:
  - Administrators can edit **all aspects** of any recorded item:
    1. **Type Transition**: Freely convert between *Befizetés (+)* (Payment), *Kiadás (-)* (Expense), and *Előírás* (Debit). Cross-collection updates automatically remove the entity from the old collection and insert into the destination collection.
    2. **Affected Flat**: Reassign to any apartment in the building, or assign expenses/deductions to the entire building (*Teljes társasház*).
    3. **Target Bank Account**: Change between Common Cost, Renovation Fund, and custom building accounts.
    4. **Streamlined Amount & Sign**: The primary type selector (*Befizetés (+)*, *Kiadás (-)*, *Előírás*) naturally governs the mathematical sign of the item. Redundant duplicate direction buttons were eliminated; a discreet, non-intrusive checkbox (*Visszautalás / negatív korrekció (-)*) is available exclusively for payments when recording rare refunds or negative adjustments, while expenses and debits remain clean with direct amount input.
    5. **Date, Category, Payee / Title, Comment, and Balance Influence**: Every metadata field is editable and re-validated.
    6. **Attachments**: Full support for attaching additional receipts, previewing images, downloading, and removing files.
- **Dedicated Inter-Account Transfer Entry (`UniversalTransactionModal.jsx`)**:
  - Features a 4th top-level transaction type: **„Átvezetés (Számlák között)”** (`ArrowLeftRight` icon, purple theme).
  - Displays dual account selectors for **Honnan (Forrás számla)** and **Hová (Cél számla)**.
  - Submitting creates two linked transactions: a deduction on the source account and a credit on the destination account, instantly correcting flat ledgers and bank reserve KPIs.

---

### 11.11 Decoupled Bank Balance Toggle UX & Subtitles (`UniversalTransactionModal` & `EditTransactionModal`)
- **Dual Balance Decoupling**:
  - Previously, unchecking "Befolyásolja a folyószámla egyenleget?" suppressed both bank account balances and apartment running balances.
  - Now, the checkbox strictly controls **bank reserves (`affectsBankBalance`)** while keeping **apartment balances (`includeInFlatBalance`)** active whenever a flat is selected.
- **Dynamic Helper Subtitles**:
  - In both `UniversalTransactionModal` and `EditTransactionModal`, the checkbox subtitle dynamically informs the user:
    - **Checked (`true`)**: *"✓ Módosítja a társasházi folyószámla főösszeget és a lakásegyenleget"* (Affects both bank account and flat balance).
    - **Unchecked (`false`)**: *"✗ Csak a lakás egyenlegét módosítja (a folyószámla főösszeget nem)"* (Affects flat balance only, bank account total unchanged).
  - Gives representatives clear visibility and confidence when recording off-bank compensations, resident offsets, or technical entries.

---

### 11.12 Same-Date Transaction Sequence & Running Balance Timeline Clarity
- **Predictable Chronological Accumulation**:
  - When an administrator copies a transaction on the same date (e.g. `2026-10-15`), the timeline respects the actual sequence of creation.
  - The initial transaction maintains its intermediate running balance (+2 930 Ft).
  - The duplicated copy is positioned above it with the final accumulated running balance (+14 930 Ft).
  - Eliminates visual anomalies where older transactions appeared with double amounts or subsequent transactions appeared to subtract funds.

---

### 11.14 Month Separators in Transaction Lists (`FullscreenTxModal.jsx`)
- **Discrete Visual Month Boundary**:
  - Whenever a list transitions from one month to another (e.g. `2024. ápr.` to `2024. máj.`), a subtle gray horizontal bar with the month and year (`bg-gray-100/90 px-4 py-1.5 border-t border-b border-gray-200`) is inserted between the rows.
  - Ensures chronological clarity across both shortened and expanded list presentations without cluttering individual transaction cards.

---

### 11.15 Category Taxonomy, Smart Fund Auto-Selection, and Payment Method UX (`UniversalTransactionModal` & `EditTransactionModal`)
- **Dynamic Category Selector (`KATEGÓRIA`)**:
  - A dedicated dropdown menu placed directly alongside the account/fund selector.
  - Dynamically populated from `currentBuilding.categories` (with fallback to system `DEFAULT_CATEGORIES`).
  - **Context-Aware Filtering**:
    - **Income / Payment (+) mode**: Displays only income categories (`type === 'income'`), e.g., Common Cost, Renovation Contribution, Extraordinary Assessment, Rental Income, Other Revenue.
    - **Expense / Debit (-) mode**: Displays only expense categories (`type === 'expense'`), e.g., Maintenance, Garbage Collection, Chimney Sweeping, Insurance, Elevator, Common Electricity, Water/Sewer, Representative Honorarium, Audit Fee, Bank Fee, etc.
  - **Smart Fund Auto-Selection**: Selecting a category automatically pre-selects the corresponding target fund (`defaultFund`, e.g. `Közös Költség` vs. `Felújítási Alap`), while leaving the field fully customizable by the user.
- **Payment Method Toggle & Smart Bank Balance Sync (`FIZETÉSI MÓD`)**:
  - Two-state selector between **Banki átutalás** (Bank Transfer, default) and **Készpénz (Pénztár)** (Cash / Cash Register).
  - **Intelligent Checkbox Synchronization**:
    - Switching to **Készpénz (Pénztár)** automatically unchecks the *"Befolyásolja a folyószámla egyenleget?"* checkbox (`affectsBalance = false`), preventing cash from skewing bank account balances.
    - Switching to **Banki átutalás** automatically re-checks it (`affectsBalance = true`).
    - The checkbox remains manually toggleable at all times with reactive visual feedback.
  - **Transaction List Visualization**:
    - The selected `paymentMethod` is saved to transaction and expense entities.
    - In the "Minden tranzakció és kiadás" feed (`AdminView.jsx`) and fullscreen ledger (`FullscreenTxModal.jsx`), Cash transactions are distinctly highlighted with a high-contrast amber badge (`Készpénz (Pénztár)` / `Cash (Register)`) right below the amount on the right side.
    - Bank transfer transactions render cleanly as `Banki átutalás` / `Bank Transfer`.
- **Form Layout & Keyboard Accessibility**:
  - Upgraded to a 2-column grid (`sm:grid-cols-2`) for compact fields (Category + Fund, Payment Method + Date), preventing vertical scrolling on standard desktop screens.
  - Expanded modal max-width to `max-w-xl sm:max-w-2xl` with enhanced padding to ensure the amount input top is never clipped under the sticky header.
  - Full keyboard accessibility: Pressing `Escape` (ESC) or clicking the backdrop dismisses the dialog instantly.

---

## 12. CONDOMINIUM LOANS & RENOVATION TARGET FUNDS MODULE (`LoansModal.jsx`)

### 12.1 Overview & Architecture
The Loans & Renovation Target Funds module is an end-to-end financial dashboard that tracks:
1. Long-term bank loans borrowed by the condominium for major capital works.
2. The distinction between residents who paid out-of-pocket up front in a lump sum (exempt from loan fees) versus residents paying monthly loan installments.
3. Bank repayment logging with live principal balance reductions.
4. Historical archives of fully repaid projects.

### 12.2 Dashboard KPI Header (4 Cards)
1. **Összes fennmaradó hiteltartozás (Total Remaining Debt)**: Live sum of all active loans' principal balances (`currentBalance`).
2. **Havi összes törlesztő (Total Monthly Installment)**: Aggregate monthly bank obligation across all active loans.
3. **Befizetett egyösszegű önrész (Total Lump Sum Collected)**: Aggregate equity collected up front from exempt residents.
4. **Aktív projektek (Active Projects)**: Number of active loans vs. total recorded projects.

### 12.3 Main Navigation & Tab Structure
1. **"Aktív hitelek" (Active Loans Tab)**:
   - Card-based layout with bank name, contract number, total cost, lump sum equity, actual loan borrowed, and current debt.
   - Progress bar illustrating repayment percentage of original principal.
   - Action buttons:
     - `[Törlesztés rögzítése]`: Opens `RecordPaymentModal` to record a monthly bank installment.
     - `[Részletek & Lakói leosztás]`: Navigates to the Participants tab for the selected loan.
     - `[Szerkesztés]` / `[Törlés]`: Admin controls to update project parameters or delete.
2. **"Résztvevők & Mentesülések" (Participants & Exemptions Tab)**:
   - Loan selector dropdown with quick switching between projects.
   - Resident search bar and segmented filters (`Összes lakás`, `Zsebből fizetett (Mentesült)`, `Hitelben törlesztő`).
   - Detailed breakdown table: Apartment number, Owner, Area ($m^2$), Payment Method badge, Lump Sum paid, Monthly contribution ($Ft/\text{hó}$).
   - **One-Click Export**: Instant export to SheetJS Excel (`.xlsx`) or `.csv`.
3. **"Törlesztési napló" (Payment History Tab)**:
   - Historical ledger of bank wire transfers.
   - Table columns: Payment Date, Total Remitted, Principal Paid, Interest Paid, Bank Fees, Remaining Principal Balance, Note, and Status (`Completed` / `Pending`).
   - Summary statistics bar for total paid, total interest, and total fees.
   - Instant export to SheetJS Excel (`.xlsx`) or `.csv`.
4. **"Lezárt / Múltbeli hitelek" (Archive Tab)**:
   - Displays projects whose principal balance reached $0\text{ Ft}$ (`paid_off`).
   - Summary cards displaying total interest paid, total fees, duration, and completion dates.

### 12.4 Sub-Modals
1. **`NewLoanModal.jsx`**:
   - Comprehensive loan project creator and editor with validation.
   - Auto-calculates expected end date from start date and term in months.
   - Live allocation generator: allows setting allocation method (`ownership_ratio`, `equal`, `fixed_amount`).
   - Interactive participant manager: quick-toggle "Mindenki hitelből" / "Mindenki zsebből", per-flat toggles, and live installment breakdown.
2. **`RecordPaymentModal.jsx`**:
   - Monthly bank installment recorder.
   - Inputs for Payment Date, Principal, Interest, Bank Fee, and Reference Note.
   - Live preview of remaining balance after payment, with celebratory payoff banner when balance reaches 0.

---

## 13. Header Navigation & Side Drawer Standard

### 13.1 Left-Aligned Menu Button
- The hamburger menu button (`<Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />`) is positioned on the **far left** of the navigation bar, immediately preceding the application brand logo.
- **Dedicated Spacing**: Features dedicated container spacing (`gap-2 sm:gap-3`), rounded border (`rounded-lg border border-gray-200 bg-white hover:bg-gray-100 shadow-2xs`), ensuring easy tactile access on mobile and desktop without cluttering right-side actions.
- **Consistency**: Appears identically on the main application header (`Header.jsx`) and in all fullscreen modal headers (`FlatsDataModal`, `ProfileModal`, `DocumentsModal`, `LoansModal`, `FinancialSituationModal`).

### 13.2 Left Slide-In Drawer (`IosSideDrawer.jsx`)
- **Slide Direction**: Opens smoothly from the **left side** (`-translate-x-full` to `translate-x-0`), reflecting standard mobile design where left menu buttons toggle left-docked navigation drawers.
- **Backdrop & Margins**: Fixed inset with `left-0 pr-10`, ensuring the backdrop remains interactive and visible on narrow viewport sizes.
- **Performance**: High-performance GPU opacity transitions (`will-change-transform`, `transition-transform duration-200 ease-out`).

### 13.3 Decluttered Header & Arrears Panel Actions
- **Header Profile/Role Badge Removed**: The desktop "Közös Képviselő" / role badge has been removed from `Header.jsx`, giving the header a clean, minimalist look focused solely on navigation, cloud sync, profile switcher, and language controls.
- **Dedicated Flats & Balances Panel Actions**: Redundant shortcut buttons ("Közgyűlés" and "Hitelek") have been removed from the "Lakások és Egyenlegek" panel header in `AdminView.jsx`. Both features are permanently and cleanly accessible through the main hamburger side drawer navigation.

---

## 14. Portfolio & Building Navigation (`PortfolioView.jsx` & Switchers)

### 14.1 Card Interaction & Keyboard Navigation
- **Double-Click Entry**: Double-clicking anywhere on a condominium card in the "Társasházaim" (Portfolio) dashboard directly opens the building view (`onSelectBuilding(b.id)`), identically to clicking "Társasház kezelése".
- **Single-Click Focus & Enter Key**: Single-clicking focuses the card (`tabIndex={0}`, with subtle focus ring `focus:ring-2 focus:ring-[#1E3A8A]/30`). Pressing `Enter` triggers immediate navigation into that building.
- **Child Click Isolation**: Nested actions such as opening the building calendar (`CalendarModal`) use `e.stopPropagation()` to prevent unintended building opening.

### 14.2 Context-Aware Profile & Building Switcher (`ProfileSwitcherButton.jsx`)
- **Hidden in Portfolio View**: When the Common Representative is on the "Társasházaim" portfolio view (`isPortfolioView === true`), the switcher button is completely hidden from the header to avoid redundancy.
- **"Társasház váltás" (Switch Building) in KK Mode**: When inside a specific condominium in Common Representative mode (`!isPortfolioView`), the button renders with a building icon (`<Building2 />`) and the label **"Társasház váltás"** (EN: "Switch Building"), opening the building selection dialog.
- **"Profilváltás" (Switch Profile) for Residents**: When logged in as a resident/owner with multiple apartments (`myFlats.length > 1`), the button retains the label **"Profilváltás"** (EN: "Switch Profile") with the users icon (`<Users />`). If the resident only has a single flat, the button is hidden.

### 14.3 Calendar & Tasks Architecture (`CalendarModal.jsx`)
- **"Naptár" Label Standard**: The portfolio action button and header buttons use the simple, clean label **„Naptár”** (EN: „Calendar”) instead of „Összesített Naptár”.
- **Header Shortcut**: A dedicated **"Naptár"** button is mounted in `Header.jsx`, giving immediate 1-click access to the calendar from anywhere in the portal.
- **Rule of Hooks Compliance**: The modal structure ensures all React hooks (`useMemo`, `useState`, `useEffect`) are executed unconditionally before any early return (`if (!isOpen) return null`), preventing React Error #310 ("Rendered more hooks than during previous render").
- **Dynamic Current Month Default Events**: Default events in `DEFAULT_CALENDAR_EVENTS` are dynamically anchored to the current year and month, ensuring the calendar grid is immediately populated with active assemblies, maintenance tasks, and deadlines.
- **Robust Array Sanitization (`ensureArray`)**: All event lists are passed through `ensureArray()`, guaranteeing that Firebase RTDB's object serialization of arrays does not cause `.filter()`, `.map()`, or iterator crashes.
- **Dedicated Day View & Seamless Month/Day Navigation**:
  - Clicking any date cell in the Month View immediately opens the dedicated **Day View** (`viewMode === 'day'`) displaying all tasks and deadlines scheduled for that date (`selectedDayEvents`).
  - The Day View features a prominent **"← Vissza a havi nézethez"** (`calendar_back_to_month`) button returning directly to the month grid.
  - **Static Adjacent Arrow Controls**: The previous day (`<`) and next day (`>`) arrow buttons are positioned **directly adjacent to each other** on the left side of the controls row, identical to the month view. This ensures the buttons remain completely static and never shift horizontally when clicking between days of differing label lengths.
- **Advanced Recurrence Engine (`isEventOnDate`)**:
  - Events support comprehensive repetition options:
    - Daily (`daily`)
    - Every weekday (`weekdays` — Monday to Friday)
    - Weekly on specified weekday (`weekly` — e.g. every Wednesday)
    - Biweekly on specified weekday (`biweekly` — every 2 weeks)
    - Monthly on the same date (`monthly_date` — e.g. every 15th of the month)
    - Monthly on nth weekday (`monthly_nth_day` — e.g. every 2nd Wednesday of the month)
    - Monthly on 1st Sunday (`monthly_first_sunday`)
    - Every 3 months / Quarterly (`quarterly`)
    - Every 6 months (`semi_annually`)
    - Annually (`yearly`)
  - Optional repetition end date (`recurrenceEndDate`), allowing indefinite repetition or time-bounded series.
  - Recurrence badge (`<Repeat />`) displayed on month grid pills, day view cards, and list view rows.
- **Priority Field Cleaned Up**:
  - Redundant priority selection and badges removed per user specification, streamlining event creation and focusing exclusively on category, timing, description, and recurrence.
- **Double-Click Event Details Modal (`viewingEvent`)**:
  - Double-clicking any event (on calendar month pills, Day View event rows, or List View cards) immediately opens the **Event Details Modal**.
  - Displays full event metadata (category, date, time, condo building, recurrence rule, and formatted agenda/notes).
  - Status toggle (`Nyitott` / `Kész`) for quick task completion.
  - Dedicated **"Szerkesztés" (Edit)** button directly opening the editing form (`handleOpenEditEvent`).
  - Dedicated **"Törlés" (Delete)** button with safe confirmation (`deleteCalendarEvent`).

---

## 15. Dinamikus Kontextusú Oldalsáv (Dynamic Context Sidebar Architecture - `IosSideDrawer.jsx`)

### 15.1 Kétállapotú Navigációs Modell (Portfolio vs. Ház-specifikus Nézet)
A közös képviselői (KK) munkafolyamat támogatása érdekében a bal oldali iOS stílusú oldalsáv (`IosSideDrawer.jsx`) dinamikusan alkalmazkodik a felhasználó aktuális kontextusához:
- **Portfólió Mód (`isPortfolioMode = isAdmin && (isPortfolioView || !currentBuildingId)`)**: Amikor a KK az összes társasházat összefogó globális áttekintőben tartózkodik, vagy még nem választott ki aktív épületet.
- **Ház-specifikus Mód (`isAdmin && !isPortfolioMode`)**: Amikor a KK egy konkrét épület részletes dashboardján és adminisztrációjában dolgozik.
- **Lakói Mód (`!isAdmin`)**: A társasházi lakók számára fenntartott tiszta, átlátható nézet (Főmenü, Pénzügyi helyzet, Dokumentumok, Lakásom/Lakásaim, Kijelentkezés).

### 15.2 Portfólió Mód Elemek (Kizárólag globális elemek)
A portfólió módban az oldalsáv kizárólag a portfólió szintű funkciókat jeleníti meg:
1. 🏢 **Társasházaim áttekintése** (`menu_portfolio_overview`): Portfólió kártyás nézet, visszalépés a társasházak listájához.
2. 📅 **Naptár & Feladatok** (`menu_calendar_and_tasks`): Az összes ház eseményeit és határidőit összesítő naptár nézet (`targetId = 'all'`).
3. ⚙️ **Fiók / Rendszerbeállítások** (`menu_account_settings`): A felhasználói fiók, jelszó és globális beállítások kezelése.
4. 🚪 **Kijelentkezés** (`logout`).

### 15.3 Ház-specifikus Mód Elemek (Szűkített ház-belső modulok)
Amikor a KK kiválaszt egy épületet (dupla kattintással vagy a "Társasház kezelése" gombbal):
1. **Figyelemfelkeltő Visszalépés Gomb**: A menü legtetején egy vibráló kék-indigo gradiens gomb kap helyet:
   `[ ← Vissza a Társasházaimhoz ]` (`menu_back_to_portfolio`), amelyre kattintva a `currentBuildingId` nullázódik és a rendszer azonnal visszavált Portfólió módba.
2. **Aktív Ház Indikátor**: Közvetlenül alatta egy dedikált tájékoztató kártya jelzi az éppen kezelt társasházat:
   `Aktív ház: [Társasház neve]` (`menu_active_building`).
3. **A 6 Ház-specifikus Modul**:
   - 🏠 **Főmenü** (`menu_main`): Az adott ház irányítópultja (KPI-k, folyószámlák, könyvelési napló, lakásrács).
   - 💳 **A ház pénzügyi helyzete** (`menu_finance`): Pénzügyi kimutatások, mérlegek, kimutatások.
   - 👥 **Lakások adatai** (`menu_flats_data`): A társasház lakásainak törzsadatai, albetét nyilvántartása és tulajdonosi elérhetőségei.
   - 📝 **Közgyűlés** (`menu_assembly`): Közgyűlési határozatok, jegyzőkönyvek és jelenléti ívek.
   - 🏛️ **Hitelek** (`menu_loans`): Társasházi hitelek, felújítási alap törlesztések és lakói leosztások.
   - 📂 **Dokumentumok** (`menu_docs`): Házhoz tartozó szerződések, szabályzatok, számlák és alapító okiratok.
4. 🚪 **Kijelentkezés** (`logout`).

### 15.4 State és Routing Integráció (`AppContext.jsx` & `AdminView.jsx`)
- **Adatvesztésmentes Szinkronizáció (`openPortfolio`)**: A portfólióba történő visszalépéskor az `openPortfolio` függvény automatikusan lementi a memóriában lévő aktív ház módosításait (albetétek, könyvelési tételek, hitelek, dokumentumok) a `state.buildings` tömbbe a `currentBuildingId` alapján, mielőtt nullázná a `currentBuildingId`-t és beállítaná az `isPortfolioView = true` értéket.
- **Kontextusváltás (`openBuildingAdmin`)**: Épület megnyitásakor az előző épület adatai szintén elmentésre kerülnek, betöltődnek az új épület adatai, a `currentBuildingId` beáll az adott épületre, és az `isPortfolioView = false` lesz.
- **Admin Dashboard Fejléc Navigáció**: Az `AdminView.jsx` felső részén is megjelenik a `[ ← Vissza a Társasházaimhoz ]` gyorsgomb és az aktív ház neve, így az oldalsáv megnyitása nélkül is egyetlen kattintással vissza lehet lépni a teljes portfólió áttekintéshez.

---

## 16. Közös Képviseleti Fiók és Rendszerbeállítások (`ProfileModal.jsx`)

A többházas portfólió szemlélethez igazítva a közös képviselő számára elérhető **"Fiók / Rendszerbeállítások"** modul szigorúan a közös képviselő (KK) személyes és vállalkozói profiljának kezelésére korlátozódik. Nem tartalmaz sem épületspecifikus, sem banki adatokat, mivel minden egyes társasház külön bankszámlákkal és banki API hitelesítő adatokkal rendelkezik. A felület három funkcionális lapra (Tab) tagolódik:

### 16.1 Vállalkozói Profil (`settings_tab_profile`)
- **Cégnév / Vállalkozás megnevezése** (`repProfile.companyName`): Hivatalos egyéni vállalkozói vagy társasági megnevezés, amely az összes generált hivatalos dokumentumon, felszólításon és kivonaton szerepel.
- **Képviselő neve** (`repProfile.name`): A felelős közös képviselő neve.
- **Központi elérhetőségek**: Központi e-mail cím (`repProfile.email`) és telefonszám (`repProfile.phone`, automatikus formázással és 1-kattintásos másolással).
- **Iroda / Levelezési cím & Ügyfélfogadás**: Székhely/iroda címe (`repProfile.address`) és ügyfélfogadási idősáv (`repProfile.officeHours`).

### 16.2 Fiók & Biztonság (`settings_tab_security`)
- **Hitelesített fiók adatai**: Aktuális bejelentkezési e-mail cím és adminisztrátori jogosultsági szint.
- **Jelszó módosítás**: Közvetlen ugrópont az `onOpenChangePassword()` biztonságos jelszócsere modáljához.
- **„Emlékezz rám” funkció**: `localStorage` és fiók-szintű biztonsági beállítás a bejelentkezés megőrzésére.
- **Munkamenet kezelés**: Aktív munkamenet állapota, utolsó felhőszinkronizáció időbélyege, és azonnali kijelentkezési lehetőség (`logout()`).

### 16.3 Globális Alkalmazás-preferenciák (`settings_tab_preferences`)
- **Alapértelmezett felületnyelv**: Kétgombos gyorsválasztó (Magyar 🇭🇺 / English 🇬🇧) az egész fiók nyelvének azonnali átváltásához (`setLanguage`).
- **Értesítési beállítások**:
  - Banki szinkronizációs hibák felugró figyelmeztetése (`notifications.bankErrors`).
  - Lejáró hitelek és célbefizetések figyelmeztetése 30 nappal a határidő előtt (`notifications.expiringLoans`).
  - Közelgő közgyűlések és meghívó-kiküldési határidők naptári emlékeztetője (`notifications.upcomingAssemblies`).
- **Alkalmazás hanghatásai**: Web Audio API alapú audio visszajelzések kapcsolója (`soundEffectsEnabled`) és beépített „Hang tesztelése” gomb.
- **Fejlesztői & Haladó beállítások**: Rendszerdiagnosztika (`debugLogging`) és helyi munkamenet-gyorsítótár ürítése.

### 16.4 Lakói / Bérlői Profil Megőrzése
A lakók (`!isAdmin`) számára a profilmodál továbbra is a lakásspecifikus alapadatokat (méret, lakók száma, tulajdoni hányad, emelet), a személyes elérhetőségeket (telefonszám, vészhelyzeti kontakt, megjegyzések) és a jelszómódosítás lehetőségét nyújtja.

---

## 17. Ház-specifikus Beállítások & Banki Integráció (`GlobalBalancesModal.jsx` / `BuildingSettingsModal`)

Mivel minden egyes társasház önálló gazdasági egység saját bankszámlaszámokkal és adott esetben saját banki API hozzáférésekkel, a házspecifikus beállítások és banki paraméterek ezen a felületen kezelhetők:

### 17.1 Épület adatai & Számlák (`bld_settings_tab_general`)
- **Társasház neve és címe**: Szerkeszthető elnevezés és hivatalos cím.
- **Adószám**: A társasház hivatalos adószáma a hivatalos kivonatokhoz.
- **Folyószámlák**:
  - Közös Költség számla (`bankKK`): Bank neve és számlaszám.
  - Felújítási Alap számla (`bankFA`): Bank neve és számlaszám.
  - Egyedi alszámlák hozzáadása (pl. Elkülönített hiteltörlesztési számla, Lekötött betét számla).
- **Induló tartalékok**: Induló közös költség és felújítási alap egyenlegek az egyenlegszámítás bázisaként.

### 17.2 Banki API Integráció (`bld_settings_tab_api`)
- **Szolgáltató**: OTP Bank CorpAPI / Open Banking, Erste Bank API, MBH Bank vagy egyéb PSD2 Open Banking API.
- **Környezet**: Sandbox (Teszt) vs. Éles (Production).
- **Ügyfélazonosító (Client ID)**: Banki regisztrációs azonosító.
- **Titkos API kulcs (Client Secret)**: Maszkolt jelszó/kulcs megjelenítési és egykattintásos vágólapra másolási lehetőséggel.
- **Automata szinkronizáció**: Napi automatikus számlatörténet-lekérés.
- **„Kapcsolat ellenőrzése”**: Valós idejű API tesztgomb állapotvisszajelzéssel.
- **Elérési pontok**:
  - `PortfolioView`: Minden társasház kártyáján közvetlenül elérhető a `[ ⚙️ Ház beállításai & Bank ]` gombbal.
  - `AdminView`: A felső kontextus sávban a `[ ⚙️ Ház adatai & Bank ]` gyorsgombbal, valamint a Folyószámlák és Tartalékok kártya `[ Szerkesztés ]` gombjával.

---

## 18. Naptár Ismétlődés, Nézetek és Színpaletta (`CalendarModal.jsx`)

### 18.1 Naptár Nézetek és Navigáció
- **Alapértelmezett Havi Nézet**: A naptár megnyitásakor (`isOpen === true`) a rendszer mindig garantáltan a **Havi nézetbe** áll be alapértelmezettként.
- **Jobb felső Nézetválasztó**: A fejléc jobb felső részén a következő három egyértelmű nézet érhető el:
  - **Havi** (`viewMode === 'month'`): Teljes havi naptárrács.
  - **Heti** (`viewMode === 'week'`): 7 oszlopos heti áttekintés (Hétfőtől Vasárnapig), heti léptető nyilakkal, dátumtartománnyal és naponkénti eseménykártyákkal.
  - **Napi** (`viewMode === 'day'`): Részletes napi bontás közvetlen visszalépési és léptetési lehetőséggel.
- **Letisztult fejléc**: A korábbi kategória-gyorszűrő gombok eltávolításra kerültek a jobb felső sarokból a maximális áttekinthetőség és tisztaság érdekében.
- **Alsó panel eltávolítva & Teljes képernyős illeszkedés**: A havi naptár alatt korábban helyet foglaló alsó fiókpanel törlésre került. A naptárrács rugalmas, reszponzív cellaméretezést kapott, így laptopon és mobilon is kényelmesen, felesleges függőleges görgetés nélkül kitölti a teljes képernyőt.
- **Közvetlen eseményrögzítés**: A havi rácsban bármelyik napra kattintva közvetlenül megnyílik az új esemény rögzítése űrlap, az adott nap dátumával előre kitöltve. Az eseménycsíkokra kattintva közvetlenül megnyílik az esemény részletes adatlapja.

### 18.2 Esemény Színválasztó a Kategóriák Helyett
- Az eseményeknél a rögzített kategóriák (közgyűlés, karbantartás, stb.) helyett tetszőleges **színek** választhatók az eseményrögzítőben:
  - 8 különböző modern színpaletta (Kék, Zöld, Lila, Narancs, Piros, Ciánkék, Indigó, Szürke).
  - Vizuális, kattintható színkörök pipa visszajelzéssel és címkével.
  - Az események naptárcsíkjai és adatlapjai egységesen a kiválasztott színstílusban jelennek meg.
  - Visszafelé kompatibilis: a korábban rögzített kategóriák automatikusan megfeleltetésre kerülnek az új színekhez.

### 18.3 Portál Stílusú Ismétlődés és Görgethető Egyéni Modál
- **Törölhető és átírható számbemenet**: Az egyéni ismétlődés ablakban az „Ismétlés minden” melletti számbemenet szabadon törölhető (Backspace billentyűvel), így a felhasználó könnyen beírhatja a kívánt többjegyű vagy új számot anélkül, hogy az azonnal visszaugrana 1-re.
- **Portál dizájnhoz illeszkedő lenyíló lista (`isRecurDropdownOpen`)**:
  A naptári eseményrögzítőben a lenyíló menü letisztult világos témában, a honlap mélykék (`#1E3A8A`) stílusához igazodva jelenik meg:
  1. *Nem ismétlődik* (`Does not repeat`)
  2. *Naponta* (`Daily`)
  3. *Hetente [adott napon]* (pl. `Minden szerdán` / `Weekly on Wednesday`)
  4. *Havonta a(z) [hanyadik] [hétköznap]on* (pl. `Minden 3. szerdán` / `Monthly on the third Wednesday`)
  5. *Évente ekkor: [hónap nap]* (pl. `Minden évben november 18.` / `Annually on November 18`)
  6. *Minden hétköznap (hétfőtől péntekig)* (`Every weekday (Monday to Friday)`)
  7. **Egyéni...** (`Custom...`)
  - **In-flow nézet és görgetésvédelem**: A lenyíló opciók in-flow blokként jelennek meg, levágás (`overflow clipping`) és mesterséges magasságkorlát (`max-h-56`) nélkül, zökkenőmentes görgethetőséggel.
- **Portál Dizájnú Egyéni Ismétlődés Ablak (`Custom recurrence`, `isCustomRecurOpen`)**:
  - Repeat every / Ismétlés minden: szám és mértékegység (nap, hét, hónap, év).
  - Repeat on / Ismétlés napjai: hetes periódusnál a hét 7 napja választható.
  - Ends / Befejezés: Soha, Dátumra, vagy N alkalom után.

### 18.4 Statikus Napi Lapozó Nyilak
- A napi nézet fejlécében a `[ < ]` és `[ > ]` léptető nyilak a bal szélre kerültek a „Vissza a havi nézethez” gomb elé.
- Pixelszinten azonos koordinátán helyezkednek el a havi nézet lapozó gombjaival, így a napok és hónapok közötti navigáció során a gombok pozíciója teljesen stabil és statikus marad.

### 18.5 Laptop Képernyőre Illesztés & Egysoros Társasház- és Dátumnavigációs Sáv
- **Egy sorban az aktuális dátummal**: A külön egész sort elfoglaló társasházválasztó eltávolításra került a felső fix fejlécből. Helyette a `Társasház: [ 🌐 Minden társasház v ]` szűrő közvetlenül a dátumnavigációs sáv jobb oldalán, az aktuálisan kiválasztott dátummal (`November 2026`, heti tartomány vagy adott nap) egyetlen sorban kapott helyet.
- **Vékonyított vezérlősáv**: A navigációs sáv magassága lecsökkent (`py-1.5 px-3 rounded-xl`), így minimális függőleges helyet foglal el.
- **Rugalmas rácsmagasság (`auto-rows-fr`)**: A havi naptárrács magassága dinamikusan, az elérhető képernyőmagassághoz igazodva arányosan osztódik szét (`flex-1 min-h-0`), minimalizált cellaméretezéssel (`min-h-[44px] sm:min-h-[50px] lg:min-h-[62px]`). Ennek köszönhetően a teljes naptár laptopképernyőn (1366x768, 1440x900 és 1080p felbontásokon, 125%/150%-os Windows skálázás mellett is) tökéletesen kifér görgetés nélkül.

---

## 19. Banki Kivonat Importálás & Intelligens Jóváhagyó Modul (`BankImportModal.jsx`, `bankParsers.js`)

### 19.1 Elhelyezés és Hozzáférés (UI / UX)
- **Helye a felületen**: Az adott társasház belső nézetében, „A ház pénzügyi helyzete” (`FinancialSituationModal.jsx`) ablak tetején egy kiemelt, figyelemfelkeltő kék akciósávban, valamint a fejléc jobb szélén elhelyezett `[ 📂 Banki importálás / Excel feltöltés ]` gombként érhető el.
- **Bankválasztó és házszintű alapértelmezés**:
  - A felugró ablak tetején a KK kiválaszthatja a társasház számlavezető bankját (OTP Bank HTML/XLS/XLSX, K&H Bank, Erste Bank, MBH Bank, CIB Bank, Raiffeisen Bank, UniCredit Bank, Általános Excel / CSV).
  - A kiválasztott bank automatikusan elmentődik az adott társasház beállításai közé (`building.defaultBank: 'otp'`), így legközelebb azonnal a megfelelő banki séma töltődik be.

### 19.2 OTP HTML / Excel Export Feldolgozó Motor (`bankParsers.js`)
- **HTML és Spreadsheet Auto-Detection**:
  - Az OTP Bank webes felületéről letöltött `.xls` fájlok valójában HTML táblázatok, amelyeket a böngésző natív `DOMParser` segítségével gyorsan és biztonságosan, kliensoldalon dolgoz fel.
  - A rendszer emellett a valódi `.xlsx` és `.csv` állományokat is hibátlanul kezeli a beépített SheetJS (`xlsx`) könyvtáron keresztül.
- **Kinyert Fejléc Adatok**:
  - Számlaszám (`accountNumber`)
  - Számla elnevezése (`accountName`, pl. "Társasház közös költség (KK)")
  - Lekérdezési időszak (`period`, pl. "2026.10.01 - 2026.10.31")
- **Oszlop-mapping és Tisztítás**:
  - Forgalom típusa, Tranzakció időpontja / Értéknap, Összeg (+ / -), Ellenoldali számlaszám, Ellenoldali név, Közlemény, Banki tranzakció azonosító.
  - Speciális magyar összegek normalizálása (`12 500,00 HUF`, `+12.500,00`, `-4 320,50`, zárójeles negatív összegek).

### 19.3 Smart Matching (Automatikus Párosító Motor)
- **Duplikáció Kiszűrés (`isDuplicate`)**:
  - Ellenőrzi a `bankTxId` banki azonosítót és az összetett kulcsot (`date + amount + flatNum + targetAccount`).
  - A korábban már lekönyvelt tranzakciókat automatikusan kiszűri és jelzi a felhasználónak, megelőzve a többszörös könyvelést.
- **Cél-alszámla Felismerés**:
  - A bankkivonat fejlécéből és a közleményből felismeri a számlát (Közös Költség vs. Felújítási Alap).
- **Lakás Felismerési Pontrendszer (Scoring Engine)**:
  1. *Bankszámlaszám egyezés* (+80 pont): a lakó korábbi bankszámlaszáma alapján.
  2. *Tulajdonos / Bérlő név egyezés* (+65/+60 pont): ékezetmentesített, normalizált névegyezés.
  3. *Közlemény szövege* (+55/+50 pont): pontos lakásszám vagy minták ("Fsz 2", "2. lakás", "ajtó 2", "1/4").
  4. *Előírási összeg egyezés* (+15 pont): az összeg pontosan megegyezik a lakás havi előírásával.
- **Státusz Kategorizálás**:
  - `Verified` (Ellenőrzött): Pozitív összegű jóváírás, ahol a lakás és az alszámla egyértelműen beazonosított. 1 kattintással kötegelten lekönyvelhető (`addMultipleItems`).
  - `Pending` (Függő tétel): Bizonytalan vagy hiányos azonosítású tételek, vagy társasházi kiadások, amelyek a jóváhagyó varázslóba (Review Wizard) kerülnek.

### 19.4 Függő Tételek Interaktív Felülvizsgálata (Review Wizard)
- Lépésről lépésre haladó varázsló a vitatott és függő tételekhez (`X / N függő tétel` folyamatjelzővel).
- **Bal oldali kártya**: Banki nyers adatok – kiemelt figyelemfelkeltő dobozban a banki közlemény, formázott összeg (+ / -), dátum, ellenoldali név és számlaszám, banki tranzakció azonosító, intelligens javaslatok listája.
- **Jobb oldali űrlap**:
  - Típus választó: *Befizetés* (Lakó egyenlegét növeli) vs. *Kiadás* (Társasházi költség).
  - Cél-lakás kiválasztása: a ház összes lakása névvel kiegészítve.
  - Cél alszámla: Közös Költség, Felújítási Alap vagy Egyedi számlák.
  - Kiadási kategória: Közmű, Biztosítás, Karbantartás, Banki költség, Egyéb.
  - Könyvelési megjegyzés szerkesztése.
- **Műveletek**:
  - `[ Kihagyás ]`: a tétel kihagyása és ugrás a következőre.
  - `[ ✅ Jóváhagyás és Könyvelés ]`: a tétel azonnali lekönyvelése és a lakásegyenleg frissítése.
- **Befejezés**:
  - Minden tétel feldolgozása után összefoglaló siker képernyő jelenik meg.

---

## 20. Lakások Lista és Csempe Nézete (Épületen Belüli Skálázhatóság)

### 20.1 Adminisztrátori Egyenleg Mátrix (`AdminView.jsx`)
- **Nézetválasztó vezérlő**: A fejlécben a cím mellett található a kétállású `[ ☰ Lista ]` és `[ ⊞ Csempe ]` kapcsoló.
- **Alapértelmezett Lista Nézet (`flatViewMode: 'list'`)**:
  - Táblázat struktúra:
    - **Albetét / Lakás**: Lakásszám zöld/piros állapotjelző indikátorral.
    - **Tulajdonos**: Név, alatta bérlő megnevezése (ha rögzítve van).
    - **KK egyenleg & FA egyenleg**: Számlánkénti aktuális egyenlegek, pirossal kiemelve tartozás esetén.
    - **Egyedi alszámlák**: Dinamikusan megjelenő oszlopok a társasházhoz konfigurált egyedi számlákhoz.
    - **Összegyenleg**: Színkódolt kapszulajelvény (Piros ha hátralékos, Zöld ha túlfizetéses, Kék ha 0).
    - **Gyorsbefizetés gombok**: `+KK`, `+FA`, egyedi számla gombok közvetlen eléréssel az 1 havi előírás rögzítéséhez anélkül, hogy a részletes kartonra kellene lépni.
    - **Műveletek**: Normál módban részletes adatlap megnyitó nyíl (`ChevronRight`), szerkesztési módban (`isGridEditMode`) törzsadat-szerkesztő és lakástörlő ikonok.
  - A teljes sorra kattintva azonnal megnyílik a lakás részletes pénzügyi adatlapja (`FlatDetailModal`).

### 20.2 Lakások Törzsadatai Modal (`FlatsDataModal.jsx`)
- **Fejléc kapcsoló**: Az összesítő sávban elhelyezett `[ ☰ Lista ]` és `[ ⊞ Csempe ]` gombok.
- **Albetét Típus Szűrősáv (Unit Type Filter Pills)**:
  - Gyorsszűrő gombok számlálóval: `Mind` (Összes albetét), `Lakások`, `Garázsok`, `Tárolók`, `Üzlethelyiségek`, `Egyéb`.
  - Dinamikusan szűri mind a táblázatos, mind a csempés nézetet az albetétek típusa (`unitType`) alapján.
- **Albetét Típus Jelvények (Badges)**:
  - Minden albetétsor és csempe kiemelt színes jelvénnyel és ikonnal jelenik meg:
    - Lakás: kék (`Home`)
    - Garázs / Beálló: smaragdzöld (`Car`)
    - Tároló / Pince: lila (`Package`)
    - Üzlethelyiség / Iroda: borostyán (`Briefcase`)
    - Egyéb: pala/szürke (`Layers`)
- **Aktív Bérlő Gyorsjelző**: Ha az albetéthez van rögzítve aktív bérlő (`isActive`), a neve diszkrét zöld jelvényként jelenik meg a tulajdonos neve mellett.
- **Lista Nézet**: Kompakt táblázat mutatja a típust és albetétszámot, tulajdonos nevét, aktív bérlőt, elérhetőségeit (e-mail és telefonszám), lakók számát, alapterületet és tulajdoni hányadot, tartozékokat (garázsok, tárolók), valamint a pénzügyi karton és törzsadat-szerkesztő műveleti gombokat.

### 20.3 Albetét Részletes Törzsadatai Multi-Tab Modal (`EditFlatMasterModal.jsx`)
- **Méretezés és Elrendezés**:
  - Tágas, nagy méretű felugró ablak (`max-w-5xl`, `h-[88vh]`), amely kényelmesen helyet biztosít az űrlapoknak, táblázatoknak és kártyáknak.
  - **Rögzített (Sticky) Fejléc és Fülsor**: Az albetét neve, típusa, aktív bérlő jelzője, a műveleti gombok (Szerkesztés / Mégse / Mentés / Bezárás) és a 4 fül mindig látható a tetején. Kizárólag az éppen aktív fül tartalma görgethető külön.
  - **Billentyűzet Kezelés (ESC)**: Globális `keydown` eseményfigyelő az ablakból való gyors kilépéshez `Escape` billentyűre vagy a háttérre kattintva.
- **A 4 Logikus Fül Struktúrája**:
  1. **"Alapadatok" (`tab_flat_basic`)**:
     - Albetét típusa (`unitType`: Lakás, Garázs, Tároló, Üzlet, Egyéb), Albetétkód, Helyrajzi szám (`hrsz`), Lépcsőház, Emelet, Ajtó.
     - Alapterület (m²), Légköbméter (m³), Tulajdoni hányad (%), Lakók száma (fő).
     - Egyedi Utaláskód (`paymentCode` / `utalaskod`) az automatikus banki közlemény-párosításhoz.
     - Vételi és eladási időpontok (`purchaseDate`, `saleDate`).
     - Jelölőnégyzetek: Cég / Jogi személy (`isCompany`), Rezsiből kihagyva (`excludeUtility`).
     - Szabad szöveges megjegyzések (`notes`).
  2. **"Tulajok / Bérlők" (`tab_flat_owners_tenants`) - Egységesített Tulajdonosi és Bérlői Nyilvántartás**:
     - **Kompakt lista + Rákattintásra lenyíló (Accordion) részletek**: Alapértelmezésben csak a legfontosabb áttekintő adatok (név, szerepkör-jelvény, tulajdoni hányad, elsődleges csillag, e-mail cím és telefonszám) láthatók, minimalizálva a vizuális zsúfoltságot.
     - Bármely személyre rákattintva az elem elegánsan lenyílik (harmonika-szerűen), felfedve a részletes űrlapot és adatokat (cím, értesítési és SZVB jelölők, ismert bankszámlaszámok, bérleti időszak, ismert utaló név).
     - **"Összes kibontása / Összecsukása" gyorsgomb**: Egyetlen kattintással az összes személy adatai egyszerre lenyithatók vagy becsukhatók.
     - **Gyorsszűrő fülek**: `Mind`, `Tulajdonosok`, `Bérlők` szűrés a listán belül.
     - **Megbízható, interaktív jelölők (gomb-alapú pipák)**:
       - Az Elsődleges kapcsolattartó (`isPrimaryContact`), E-mailes értesítés (`sendEmailNotification`), SZVB tag (`isBoardMember`) és Bérlő aktív státusz (`isActive`) közvetlenül, hibamentesen kattintható.
       - A felesleges "Banki utaló" jelölő eltávolításra került.
     - **Tulajdonosok és Bérlők világos megkülönböztetése**:
       - Tulajdonosok: Kék / Indigó vizuális téma, szerepkör (`owner`, `coowner`, `beneficiary`), tulajdoni hányad összegző valós idejű validációval.
       - Bérlők: Smaragdzöld vizuális téma (aktív) vagy szürke (korábbi), bérleti időszak, 1-kattintásos "Kiköltözés / Lezárás" funkció.
  3. **"Mérőórák" (`tab_flat_meters`)**:
     - Albetéti mérőórák nyilvántartása (Hideg víz, Meleg víz, Fűtés, Villany, Gáz, Egyéb).
     - Mezők: Gyári szám / Sorozatszám, Típus, Beszerelés dátuma és kezdő állása, Aktuális állás, Utolsó leolvasás dátuma, Hitelesítés / Lejárat dátuma, Leszerelés dátuma és végállása.
     - **Lejárati Figyelmeztető Rendszer**:
       - Hitelesítés lejárt: villogó piros figyelmeztető jelvény (`Hitelesítés lejárt!`).
       - 180 napon belül lejár: narancssárga figyelmeztetés a hátralévő napok számával (`Hamarosan lejár (X nap)`).
       - A fülsoron pulzáló piros pötty jelzi, ha a lakásban van beavatkozást igénylő mérőóra.
  4. **"Tartozékok" (`tab_flat_annexes`)**:
     - Nem önálló albetétként kezelt kiegészítők és helyiségek (pl. felszíni beálló, tárolórekesz, terasz, vízátalány).
     - Mezők: Kód / Azonosító, Megnevezés, Mennyiség, Mértékegység (`db`, `m²`, `m³`, `Ft`).
     - Teljes visszamenőleges kompatibilitás a korábbi `garages` és `storages` tömbökkel.
- **Intelligens Banki Tranzakció-Párosítás (Smart Matching Integration)**:
  - Az albetét felismerési kulcsai automatikusan beépülnek a banki import és közvetlen OTP API motorba:
    1. Az albetét `paymentCode` / `utalaskod` mezője kiemelt 85 pontos prioritással egyezik a közleményre.
    2. Minden tulajdonos/haszonélvező neve és megadott bankszámlaszáma automatikusan felismeri az utalót.
    3. Az aktuálisan **aktív** bérlők neve, utaló neve és bankszámlaszáma bekerül a felismerési indexbe, miközben a korábbi, kiköltözött bérlők számláit a rendszer automatikusan kizárja az új utalásokból.

---

## 8. Oldalfrissítés (F5 / Reload) Állapotmegőrzés és Navigáció

Az alkalmazás képes megőrizni az éppen nyitva lévő nézetet és modális ablakokat még akkor is, ha a felhasználó frissíti a böngészőoldalt (`F5` vagy reload gomb).

### 8.1 Megőrzött Állapotok és URL Szinkronizáció
- **Albetét Részletes Nézet (`FlatDetailModal`)**: Ha a felhasználó pl. az 1-es lakásban volt (`flatDetailNum = '1'`), újratöltés után a rendszer azonnal az 1-es lakás adatlapját nyitja meg (`#flat=1`).
- **Albetét Törzsadat Nézet (`EditFlatMasterModal`)**: Ha a törzsadat szerkesztő volt megnyitva (pl. `#master=1&bId=building-001`), újratöltéskor a teljes 4 füles törzsadat ablak jelenik meg újra.
- **Rétegzett Megnyitás ("Lakások adatai" + Albetét)**: Ha a felhasználó a "Lakások adatai" modálból (`isFlatsDataOpen`) nyitotta meg az 1-es lakást (`#flat=1&from=flats`), frissítéskor mindkét ablak megfelelően megnyílik, és a lakás bezárásakor a felhasználó a megszokott módon a "Lakások adatai" listában marad.
- **Egyéb Modálok Megőrzése**:
  - Pénzügyi helyzet (`#view=finance`)
  - Dokumentumtár (`#view=docs`)
  - Kölcsönök és törlesztések (`#view=loans`)
  - Közgyűlések (`#view=assembly`)
  - Naptár (`#view=calendar`)
  - Alapok & Beállítások (`#view=balances`)
  - Profil & Beállítások (`#view=profile`)

### 8.2 Mechanizmus és Biztonság
- **`sessionStorage["tarsas_nav_state"]`**: Biztonságosan tárolja az aktív fül és modál referenciákat az aktuális böngészőfül munkamenetében. Nem szivárog át új lapokra vagy más felhasználókhoz.
- **`window.history.replaceState`**: Szinkronban tartja az URL címkét anélkül, hogy teleírná a böngészési előzményeket.
- **Böngésző Vissza/Előre Gombok (`hashchange`)**: Ha a felhasználó a böngésző "Vissza" gombját használja, a rendszer intelligensen visszalép az előző nézetbe, ahelyett hogy bezárná az oldalt.
- **Kijelentkezési Védelem**: Kijelentkezéskor (`logout()`) vagy profilváltáskor a navigációs állapot és az URL hash automatikusan törlődik, megelőzve az illetéktelen visszanyitást.

---

## 9. Egyetlen Tiszta Görgetősáv (Kettős Görgetősáv Megszüntetése)

A teljes képernyős modáloknál (pl. "Lakások adatai", "Pénzügyi helyzet", "Dokumentumok", "Hitelek") korábban jelentkező flexbox eredetű kettős függőleges görgetősáv véglegesen megszüntetésre került.

### 9.1 A Hiba Oka és Architektúrája
- **CSS Flexbox `min-height: auto` Alapértelmezés**: A flex oszlop gyerekek (`div.flex-1`) alapértelmezetten nem zsugorodhatnak a tartalmuk mérete alá. A nagyméretű adattáblázat miatt a flex gyerek magassága kitolta a szülő `fixed inset-0` konténert a képernyőből, ami a böngészőablakon egy inaktív külső görgetősávot hozott létre a belső tartalom görgetősávja mellett.
- **Megoldás**:
  1. A külső rögzített konténer kötelezően `overflow-hidden` osztállyal rendelkezik (`fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn`), megakadályozva a viewport túlcsordulását.
  2. A belső tartalomgörgető kötelezően `min-h-0` osztállyal van ellátva (`flex-1 min-h-0 overflow-y-auto w-full overscroll-contain`), ami engedélyezi a rugalmas zsugorodást a rendelkezésre álló magasságba.
  3. Ennek köszönhetően a jobb szélen kizárólag **egy darab**, valóban működő görgetősáv jelenik meg.

---

## 10. Közvetlen, Mindig Aktív Szerkesztés az Albetét Törzsadatoknál (`EditFlatMasterModal.jsx`)

Az albetétek törzsadatait kezelő ablak a megnyitás pillanatától azonnal és közvetlenül szerkeszthető.

### 10.1 Szerkesztési és Interakciós Szabályok
- **Nincs Rejtett Megtekintő Mód**: A modál megnyitásakor az összes mező azonnal aktív, modern beviteli mezőként (`input`, `select`, `textarea`) jelenik meg. Nem szükséges előzetesen külön "Szerkesztés" gombra kattintani.
- **Azonnal Kattintható Jelölőnégyzetek és Gombok (Zero `disabled`)**:
  - `isCompany`: Cég / Jogi személy jelölő azonnal ki/be pipálható.
  - `excludeUtility`: Rezsiből kihagyva jelölő azonnal ki/be pipálható.
  - `isPrimaryContact`: Elsődleges kapcsolattartó csillag/pipa azonnal kattintható.
  - `sendEmailNotification`: E-mail értesítés kérése azonnal kattintható.
  - `isBoardMember`: SZVB tagság azonnal kattintható.
  - `isActive`: Aktív bérlő státusz kapcsoló azonnal működik.
- **Kiemelt Fejléc és Lábléc Műveletek**:
  - A fejlécben és a láblécben egyaránt jól látható, kék **"Mentés"** gomb (`<Save />`) és szürke **"Mégse"** gomb áll rendelkezésre.
  - A Mentés gombra kattintva a rendszer azonnal elmenti az új adatokat a felhőbe, visszajelző értesítést (toast) küld, és elegánsan bezárja a modált.
  - A Mégse gomb, az `X` gomb vagy az `Escape` billentyű elveti a még nem mentett vázlatot.












