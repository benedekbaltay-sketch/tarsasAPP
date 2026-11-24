# AGENT.md — Developer & AI Agent Guide & Router

Welcome! If you are an AI assistant or human developer working on this codebase, **this file is your primary entry point and operational router**.

---

## 1. Golden Operating Rules (Alapszabályok)

A rendszer fejlesztése és karbantartása során az alábbi 4 alapszabály és kötelező irányelv betartása minden esetben megkerülhetetlen:

> [!CAUTION]
> ### 🛑 SZABÁLY 3: SZIGORÚ ADATBÁZIS-MÓDOSÍTÁSI ÉS JÓVÁHAGYÁSI SZABÁLY (STRICT DATA PERMISSION RULE)
> **AZ ADATBÁZISBAN (Firebase RTDB, LocalStorage, mock állapot) LÉVŐ ADATOKAT MÓDOSÍTANI, TÖRÖLNI, FELÜLÍRNI VAGY TESZTELNI KIZÁRÓLAG A FELHASZNÁLÓ KIFEJEZETT ELŐZETES ENGEDÉLYÉVEL SZABAD! HA NEM AD UTASÍTÁST, TILOS VÁLTOZTATNI RAJTA.**
> 1. **Tilos automatikus tesztekből éles adatot írni/törölni:** Semmilyen automatizált böngésző script (pl. headless browser), teszt script vagy CLI script NEM módosíthatja az éles adatbázist (`https://tarsashaz-cfe5d.web.app`, Firebase RTDB). Tesztek kizárólag mock / memória adatokkal futhatnak.
> 2. **Kötelező előzetes jóváhagyás:** Bármilyen könyvelési tétel (befizetés, kiadás, terhelés, lakásadat, induló egyenleg) felvitele, módosítása vagy törlése előtt az AI asszisztensnek **mindig meg kell kérdeznie a felhasználót, és csak explicit engedéllyel végezheti el**.
> 3. **Állandó és visszavonhatatlan érvényesség:** Ez a szabály a projekt minden jelenlegi és jövőbeli beszélgetésére, minden feladatra és minden agentre kötelező érvényű.

> [!IMPORTANT]
> ### 🌐 SZABÁLY 1: KÉTNYELVŰSÉGI SZABÁLY (BILINGUAL MANDATE)
> **Mindent angolra is le kell fordítani**, hogy a felhasználó bármikor zökkenőmentesen tudjon váltani a magyar (`hu`) és az angol (`en`) nyelv között. Bármilyen új felhasználói felület, gomb, címke, felugró ablak, hibaüzenet vagy tájékoztató szöveg hozzáadásakor kötelező mind a magyar, mind az angol szótárt frissíteni a `src/constants/translations.js` fájlban.

> [!IMPORTANT]
> ### 📚 SZABÁLY 2: DOKUMENTÁCIÓS SZABÁLY (DOCUMENTATION MANDATE)
> **Mindent dokumentálni kell.** A rendszer dokumentációját (`/docs`, `AGENT.md`, `GEMINI.md`) minden változás, új funkció, képlet vagy sémamódosítás esetén kötelező azonnal bővíteni és frissíteni a munkafolyamat lezárása előtt.
> **Kötelező mankóként használni:** Minden új feladat megkezdése előtt kötelező áttekinteni a releváns dokumentumokat, és azokra támaszkodva elvégezni a feladatot, fenntartva a rendszer integritását.

> [!IMPORTANT]
> ### 🔒 SZABÁLY 4: ADATBIZTONSÁG ÉS FELTÖRHETETLENSÉG (SECURITY & INVIOLABILITY MANDATE)
> **Mindig arra kell törekedni, hogy az adatbiztonság és a feltörhetetlenség előre haladjon.** Minden újratervezésnél és funkciónál a legszigorúbb biztonsági alapelveket (autentikáció, szerepkör-alapú jogosultságok, adatfertőtlenítés, adatizoláció) kell alkalmazni. Esetleges gyenge pont, rés vagy sebezhetőség észlelése esetén az AI asszisztensnek azonnal proaktív javaslatot kell tennie a védelem megerősítésére (lásd: [docs/SECURITY_AND_DATA_PROTECTION.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/SECURITY_AND_DATA_PROTECTION.md)).

> [!WARNING]
> ### 🛡️ TOVÁBBI OPERATÍV SZABÁLYOK:
> 1. **Never Touch `new-project/` (5. szabály)**: A `new-project/` mappa a korábbi verzió archívuma, szigorúan **csak olvasható**. Soha ne szerkessz, ne mozgass és ne törölj semmit benne.
> 2. **Rendszeres Git Mentés és Push (6. szabály)**: Minden nagyobb, tesztelt mérföldkő vagy funkcióblokk lezárásakor kötelező ellenőrizni a `git status`-t (biztosítva, hogy semmilyen titok, `.env`, privát kulcs vagy PII dump nem kerül be), majd tiszta commit-tal fel kell pusholni a változtatásokat a GitHub `origin/main` ágra, hogy munka soha ne veszhessen el.
> 3. **Protect State Revision & Concurrency**: Soha ne kerüld meg a 3-szintű perzisztencia modellt (RTDB módban) vagy az atomi Firestore/Cloud Functions modellt (Firestore módban).

---

## 2. Technology Stack Quick Reference

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Framework** | **React 18** (SPA) | Pure client-side React with functional components, hooks, and Context API. |
| **Build Tool** | **Vite 8** | Fast HMR and Rolldown-based production build (`npm run dev`, `npm run build`). |
| **Styling** | **Tailwind CSS 3** | Utility classes + custom design tokens (`#1E3A8A` deep blue, `#F3F4F6` background). |
| **Cloud Database**| **Firebase 13** | Legacy RTDB (`condo_state`) + ready-to-cutover Cloud Firestore & Storage (`firestore.rules`, `storage.rules`, `functions/`). |
| **Local Storage** | **Browser LocalStorage**| Cached under key `tarsashaz_state` (binaries & secrets stripped). Session under `tarsashaz_logged_in_user`. |
| **Deletion Tombstones**| **Permanent Vault** | Stored in `localStorage["tarsashaz_permanent_vault"]` to prevent deleted items from resurrecting. |
| **Spreadsheet** | **`write-excel-file` & `read-excel-file`** | Zero-CVE browser/Node Excel export & import with CWE-1236 formula injection neutralization (SheetJS `xlsx` removed). |
| **Icons** | **Lucide React** | Feather-based lightweight vector icons. |
| **QR Code / Payments** | **qrcode.react** | MNB / qvik instant payment QR code generation (SVG format). |
| **Typography** | **Google Fonts** | `Inter` for general UI text; `Outfit` for numerical financial indicators. |
| **Localization**| **Custom i18n** | Full Hungarian (`hu`) and English (`en`) support via [translations.js](file:///c:/Users/bened/Documents/tarsasAPP/src/constants/translations.js). |

For full details, see [docs/TECH_STACK.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/TECH_STACK.md).

---

## 3. Documentation Router — Where to Look

All system knowledge is organized in the [`/docs`](file:///c:/Users/bened/Documents/tarsasAPP/docs/) directory:

| What do you need to know? | Consult Document | Description |
| :--- | :--- | :--- |
| **Product Purpose & Philosophy** | [docs/PROJECT_CONTEXT.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/PROJECT_CONTEXT.md) | High-level conceptual model, owner-first UX, long-term multi-building vision. |
| **Technical Stack & Tooling** | [docs/TECH_STACK.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/TECH_STACK.md) | Packages, scripts, dependencies, build configurations, browser support. |
| **Architecture & Persistence** | [docs/ARCHITECTURE.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/ARCHITECTURE.md) | Component tree, Context API, Firebase sync, concurrency merge, wake-up listeners. |
| **Data Models & Schema** | [docs/DATABASE_SCHEMA.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/DATABASE_SCHEMA.md) | Complete schemas for Buildings, Flats, Transactions, Expenses, Users, Vault. |
| **Financial Ledger Formulas** | [docs/FINANCIAL_RULES.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/FINANCIAL_RULES.md) | Monthly debits, running balances, KK vs FA accounts, starting balance calibration. |
| **Authentication & Roles** | [docs/AUTH_AND_PERMISSIONS.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/AUTH_AND_PERMISSIONS.md) | Representative vs Owner vs IT Manager, demo accounts, password resets. |
| **UI, Views & Modals** | [docs/UI_UX_SPEC.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/UI_UX_SPEC.md) | Specifications for LoginView, TenantView, AdminView, 14 Modals, iOS drawer. |
| **Security & Inviolability** | [docs/SECURITY_AND_DATA_PROTECTION.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/SECURITY_AND_DATA_PROTECTION.md) | Threat modeling, weak point analysis, and actionable security hardening proposals. |

---

## 4. Repository Structure

```
tarsasAPP/
├── AGENT.md                     <-- YOU ARE HERE (Master agent router)
├── package.json                 <-- Dependencies & build scripts
├── vite.config.js               <-- Vite SPA configuration
├── tailwind.config.js           <-- Tailwind brand colors & typography tokens
├── postcss.config.js            <-- PostCSS with Autoprefixer
├── index.html                   <-- Root HTML referencing /src/main.jsx
├── public/
│   └── favicon.svg              <-- Brand building SVG icon
├── docs/                        <-- Central System Documentation
│   ├── PROJECT_CONTEXT.md       <-- Authoritative product vision & domain model
│   ├── TECH_STACK.md            <-- Technology stack details
│   ├── ARCHITECTURE.md          <-- Software architecture & persistence
│   ├── DATABASE_SCHEMA.md       <-- Database schemas & RTDB structure
│   ├── FINANCIAL_RULES.md       <-- Ledger mathematics & calculations
│   ├── AUTH_AND_PERMISSIONS.md  <-- Roles, auth flow, and credentials
│   ├── UI_UX_SPEC.md            <-- Views, modals, and design tokens
│   └── SECURITY_AND_DATA_PROTECTION.md <-- Threat model, vulnerabilities & hardening proposals
├── src/
│   ├── main.jsx                 <-- React DOM mounting & root ErrorBoundary
│   ├── App.jsx                  <-- Layout router & modal orchestrator
│   ├── index.css                <-- Tailwind directives, custom scrollbars, animations
│   ├── constants/
│   │   ├── firebaseConfig.js    <-- Firebase app & RTDB connection
│   │   ├── translations.js      <-- Hungarian (hu) & English (en) dictionaries
│   │   └── defaultData.js       <-- Initial buildings, users, documents dataset
│   ├── context/
│   │   ├── AppContext.jsx       <-- Central state store, provider, RTDB WebSocket listener, Toast & dispatch
│   │   ├── syncEngine.js        <-- CRDT merge, tombstone vault, binary stripping & cloud sanitization
│   │   ├── authActions.js       <-- Zero-trust login, impersonation, profile/role switching, password change
│   │   ├── calendarActions.js   <-- Calendar events, tasks, deadlines, completion toggle
│   │   ├── accountingActions.js <-- Financial transactions, expenses, manual debits, balances, clipboard
│   │   └── buildingActions.js   <-- Building & flat CRUD, document upload/fetch/delete
│   ├── utils/
│   │   ├── finances.js          <-- Financial math engine & ledger generators
│   │   ├── qvik.js              <-- MNB / qvik instant payment QR URL generator & Hungarian IBAN helper
│   │   ├── assembly.js          <-- Tht. General Assembly accounting & statement calculations
│   │   ├── exportExcel.js       <-- SheetJS Excel export utilities & Tht. reports
│   │   ├── phone.js             <-- Hungarian & international phone number normalization
│   │   └── sound.js             <-- Web Audio API notification feedback sounds
│   ├── components/
│   │   ├── Header.jsx           <-- App header with profile, role switchers & language toggles
│   │   ├── ImpersonationBanner.jsx <-- Pinned banner during SuperAdmin act-as mode
│   │   ├── ProfileSwitcherButton.jsx <-- Universal top header profile & flat switcher
│   │   ├── NavLogoButton.jsx    <-- Brand logo button for header navigation
│   │   ├── IosSideDrawer.jsx    <-- Slide-in iOS drawer navigation (Társasházaim, Naptár, etc.)
│   │   └── modals/              <-- CalendarModal, UniversalTransactionModal, AssemblyModal, SmartMobilePayModal, QuickPay, etc.
│   └── views/
│       ├── LoginView.jsx        <-- Login form, credentials, & 1-click demo tiles
│       ├── PortfolioView.jsx    <-- Representative portfolio dashboard (Társasházaim, aggregates, cards)
│       ├── TenantView.jsx       <-- Resident dashboard, bank details, statements
│       ├── AdminView.jsx        <-- Representative KPIs, arrears matrix, 8-item tx feed, Assembly tab
│       └── SuperAdminView.jsx   <-- System administrator tree view & representative impersonation
└── new-project/                 <-- LEGACY ARCHIVE (DO NOT TOUCH)
```

---

## 5. Development & Testing Commands

Run all commands from the project root (`c:\Users\bened\Documents\tarsasAPP\`):

```powershell
# Start local development server (http://localhost:3000)
npm run dev

# Build for production (verifies syntax, JSX, Rolldown bundling)
npm run build

# Preview production build locally
npm run preview

# Run automated security controls, Firestore adapter, atomic math & Firestore rules tests
npm run test:security
npm run test:adapter
npm run test:atomic
npm run test:rules
```

---

## 6. Clipboard & Keyboard Copy/Paste Behavior
- **Billentyűzetes másolás (`Ctrl+C` / `Ctrl+V`)**: A táblázatokban kijelölt tétel másolható (`Ctrl+C`) és beilleszthető (`Ctrl+V`), ha egy tétel aktívan ki van jelölve.
- **Fejléc gomb eltávolítva**: A korábbi zöld „Beillesztés (Ctrl+V)” gomb el lett távolítva a fejlécekből (`AdminView.jsx`, `FlatDetailModal.jsx`), így a felület letisztult, a másolás és beillesztés pedig kizárólag a gyors és tiszta billentyűparancsokkal működik.
- **Szigorú hitelesítés (Security Rule 4)**: A bejelentkezés szigorúan csak a felhasználó által begépelt érvényes jelszóval engedélyezett; minden korábbi beégetett jelszó-fallback és bypass el lett távolítva a kódból.

---

## 7. Condominium Loans & Renovation Funds Module (Hitelek és célbefizetések modul)
- **Célja**: Társasház által felvett felújítási hitelek rögzítése, törlesztési napló vezetése, lakói egyösszegű előtörlesztések/önrészek nyilvántartása és mentesülése, valamint a hitelben maradó lakók arányos törlesztőrészleteinek havi automatikus előírása a felújítási alapban.
- **Komponensek & Fájlok**:
  - `src/components/modals/LoansModal.jsx`: Fő hitelek modul dashboard KPI kártyákkal és 4 füllel (Aktív hitelek, Résztvevők & Mentesülések, Törlesztési napló, Lezárt/Archívum).
  - `src/components/modals/LoanModals/NewLoanModal.jsx`: Új hitel felvétele és szerkesztése validációval, lejárati dátum automatikus számításával, és lakásonkénti fizetési mód / előleg kezeléssel.
  - `src/components/modals/LoanModals/RecordPaymentModal.jsx`: Banki havi törlesztés rögzítése tőke, kamat, banki díj bontással és automatikus tőketartozás-csökkentéssel (`currentBalance`).
  - `src/context/loanActions.js`: `addLoan`, `updateLoan`, `deleteLoan`, `recordLoanPayment`, `deleteLoanPayment`.
  - `src/utils/loans.js`: Dátumszámítások, részesedés-szétosztás (`ownership_ratio`, `equal`, `fixed_amount`), törlesztési haladás számítása.
  - `src/utils/exportExcel.js`: SheetJS Excel (`.xlsx`) és `.csv` export a törlesztési naplóhoz és lakói részvételi névsorhoz.
  - `src/utils/finances.js`: A havi előírásokban kizárólag a `financed` lakók kapják meg a törlesztő sort; a zsebből fizetett (`lump_sum`) lakók teljes mentesülést élveznek.

---

## 8. Professional & Minimalist Filtering Engine (`TransactionFilterBar.jsx`)
- **Letisztult szűrési architektúra**:
  - `src/components/TransactionFilterBar.jsx`: Minimalista, modern vezérlőpult, amely egyaránt támogatja a globális és lakásszintű tételeket (`mode="global"` vs `"flat"`).
  - `src/utils/filterUtils.js`: CRDT-biztos szűrési logika: Típus (`all`, `income`, `expense`), Számla (`all`, `KK`, `FA`), Időszak (`thisMonth`, `last30Days`, `last3Months`, `thisYear`, `custom`), és Összegtartomány.
  - **Mindig látható aktív szűrőcímkék**: Amikor egy szűrő aktív, az összecsukott nézetben is azonnal megjelenik egy vékony, elegáns sáv a címkékkel, egykattintásos `✕` törléssel és találatszámlálóval.

---

## 9. Header Navigation & Side Drawer Architecture
- **Bal oldali menü gomb elhelyezés**:
  - A 3 vonalas menü gomb (`<Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />`) a fejléc **bal oldalán**, közvetlenül a logó előtt kapott dedikált helyet és térközt minden felületen (`Header.jsx`, `FlatsDataModal.jsx`, `ProfileModal.jsx`, `DocumentsModal.jsx`, `LoansModal.jsx`, `FinancialSituationModal.jsx`).
  - A jobb oldali műveleti sávból törlésre került, így nem zsúfolja a profilváltót és a szinkronizáció jelzőt.
- **Bal oldalról kinyíló fiók (`IosSideDrawer.jsx`)**:
  - A fiók a bal szélről gördül be (`-translate-x-full` -> `translate-x-0`, `left-0 pr-10`), tökéletesen lekövetve a bal oldali menügomb pozícióját.
- **Fejléc és Lakások és Egyenlegek felület letisztítása**:
  - A fejlécből eltávolításra került a „Közös Képviselő” / szerepkör jelvény, ezáltal a fejléc letisztultabb.
  - A „Lakások és Egyenlegek” panel fejlécéből kikerült a „Közgyűlés” és „Hitelek” gomb, mivel mindkét funkció közvetlenül és zavartalanul elérhető az oldalsó főmenüből (hamburger menüfiók).

---

## 10. Portfolio Navigation & Role-Based Switchers (`PortfolioView.jsx`, `ProfileSwitcherButton.jsx`)
- **Társasház kártya interakciók (`PortfolioView.jsx`)**:
  - **Dupla kattintás**: Bármely társasház kártyájára duplán kattintva a rendszer azonnal belép a ház vezérlőpultjába (`onSelectBuilding(b.id)`), pontosan úgy, mintha a „Társasház kezelése” gombra kattintott volna.
  - **Egyszeri kattintás + Enter**: A kártyára kattintva fókuszba kerül (`tabIndex={0}`, lágy körvonallal), majd az `Enter` billentyű leütésére szintén azonnal megnyílik a társasház.
  - **Esemény-izoláció**: A kártyán lévő belső naptár és kezelés gombok `e.stopPropagation()`-nal vannak ellátva, így nincsenek duplán lefutó események.
- **Kontextus-függő profil- és társasházváltó gomb (`ProfileSwitcherButton.jsx`)**:
  - **Társasházaim (Portfólió) nézetben elrejtve**: Amikor a KK a teljes portfóliót tekinti át (`isPortfolioView === true`), a fejlécben egyáltalán NEM jelenik meg profilváltás / társasházváltás gomb.
  - **Egy házon belül KK módban**: A gomb neve **„Társasház váltás”** (EN: „Switch Building”), ikonja `<Building2 />`, és a társasházválasztó modált nyitja meg a házak közötti gyors váltáshoz.
  - **Lakói (tulajdonosi) módban**: Ha egy lakó több lakással is rendelkezik (`myFlats.length > 1`), a gomb neve továbbra is **„Profilváltás”** (EN: „Switch Profile”), ikonja `<Users />`. Ha csak egy lakása van, a gomb rejtve marad.
- **Naptár és Feladatok modul (`CalendarModal.jsx`)**:
  - Letisztult elnevezés: „Összesített Naptár” helyett egységesen **„Naptár”** (EN: „Calendar”).
  - React Hook szabályok betartása: minden hook feltétel nélkül, korai `return` előtt fut le, elhárítva a 310-es React hibát.
  - Közvetlen 1-kattintásos elérés a felső menüsorból (`Header.jsx`) a dedikált „Naptár” gombbal.
  - Dinamikus aktuális havi mintaesemények (`DEFAULT_CALENDAR_EVENTS`), így a naptár azonnal feltöltve, látványosan jelenik meg az aktuális hónapban.
  - `ensureArray` védelem a Firebase RTDB objektumszerializációja ellen, garantálva a hibamentes eseménykezelést és szinkronizációt.
  - **Közvetlen Napi nézet és statikus egymás melletti nyilak**: A havi naptárban bármely napra kattintva azonnal megnyílik a dedikált **Napi nézet** (`viewMode === 'day'`), amely az adott nap összes feladatát és eseményét listázza. A nézet tetején jól látható **„← Vissza a havi nézethez”** gombbal lehet visszalépni. A napozó nyilak (`<`, `>`) **egymás mellett, statikusan helyezkednek el a bal oldalon** a hónapos nézethez hasonlóan, így a gombok nem mozognak a dátum szövegének változásakor.
  - **Ismétlődő események motorja (`isEventOnDate`)**: Teljes ismétlődési támogatás (naponta, minden hétköznap, hetente adott napon, kéthetente, havonta adott napon, havonta adott hétköznapon, minden hónap 1. vasárnapján, 3 havonta / negyedévente, 6 havonta, évente) opcionális lejárati határidővel.
  - **Prioritás mező kivezetése**: A felesleges prioritás választó eltávolításra került a felületről a felhasználói igényeknek megfelelően.
  - **Dupla kattintásos esemény megnyitás, szerkesztés és törlés**: Bármely eseményre duplán kattintva (akár a havi nézet pill-jén, akár a napi nézetben vagy lista nézetben) felugrik a részletes esemény adatlap (`viewingEvent`), ahol azonnal elérhető a **„Szerkesztés”** és a **„Törlés”** funkció.

---

## 12. Dinamikus Kontextusú Oldalsáv és Portfólió Navigáció (`IosSideDrawer.jsx`)
- **Kétállapotú oldalsáv (Dinamikus kontextus)**:
  - **Portfólió Mód (`isPortfolioMode = isAdmin && (isPortfolioView || !currentBuildingId)`)**:
    - 🏢 **Társasházaim áttekintése** (`menu_portfolio_overview`): Portfólió kártyás nézet.
    - 📅 **Naptár & Feladatok** (`menu_calendar_and_tasks`): Az összes kezelt társasház eseményeit összesítő naptár.
    - ⚙️ **Fiók / Rendszerbeállítások** (`menu_account_settings`): Felhasználói profil és rendszerbeállítások.
    - 🚪 **Kijelentkezés** (`logout`).
  - **Ház-specifikus Mód (`isAdmin && !isPortfolioMode`)**:
    - **Figyelemfelkeltő visszalépés gomb legfelül**: `[ ← Vissza a Társasházaimhoz ]` (`menu_back_to_portfolio`), kék-indigo színátmenettel és balra nyíllal, amelyre kattintva a `currentBuildingId` nullázódik és visszaváltunk Portfólió módba.
    - **Aktív ház neve alatta**: `Aktív ház: [Társasház neve]` (`menu_active_building`) elegáns információs kártyán.
    - **A 6 ház-specifikus modul**:
      1. 🏠 **Főmenü** (`menu_main`): Dashboard KPI-k, számlák, könyvelés.
      2. 💳 **A ház pénzügyi helyzete** (`menu_finance`): Pénzügyi kimutatások.
      3. 👥 **Lakások adatai** (`menu_flats_data`): Albetétek és tulajdonosok névsora.
      4. 📝 **Közgyűlés** (`menu_assembly`): Határozatok és jegyzőkönyvek.
      5. 🏛️ **Hitelek** (`menu_loans`): Hitelek és törlesztések.
      6. 📂 **Dokumentumok** (`menu_docs`): Házhoz tartozó iratok.
    - 🚪 **Kijelentkezés** (`logout`).
- **State és Routing integráció (`AppContext.jsx`)**:
  - `openPortfolio()`: Automatikusan szinkronizálja az aktív ház memóriabeli adatait a `state.buildings` tömbbe, majd `currentBuildingId = null` és `isPortfolioView = true` értékre áll, garantálva az adatvesztésmentes visszalépést.
  - `openBuildingAdmin(buildingId)`: Lementi az előző épület adatait, betölti a célépület adatait, beállítja a `currentBuildingId`-t és `isPortfolioView = false`.
  - `AdminView.jsx`: A fő admin irányítópult tetején is elérhető a `[ ← Vissza a Társasházaimhoz ]` gyorsgomb és az aktív ház indikátor.

---

## 13. Globális Portfólió Beállítások vs Ház-specifikus Beállítások Szétválasztása

A többházas portfólió szemlélethez igazítva a globális képviseleti beállítások és az egyedi társasházi beállítások szigorúan különválasztásra kerültek:

### A) Globális / Portfólió szintű beállítások (`ProfileModal.jsx`)
Kizárólag a közös képviselő (KK) személyes és vállalkozói profiljának kezelésére szolgál. Nem tartalmaz épületspecifikus vagy banki adatokat:
1. 🏢 **Vállalkozói profil**: Cégnév (`repProfile.companyName`), Képviselő neve, Központi e-mail és telefonszám (formázással és másolással), Iroda/levelezési cím és ügyfélfogadási idősáv.
2. 🔒 **Fiók & Biztonság**: Bejelentkezett e-mail, Jelszó módosítás (`onOpenChangePassword()`), „Emlékezz rám” státusz és biztonsági kijelentkezés.
3. ⚙️ **Alkalmazás-beállítások**: Alapértelmezett nyelv váltó (Magyar / English), Értesítési preferenciák (banki szinkronizációs hibák, lejáró hitelek, közelgő közgyűlések), Alkalmazás hanghatásai Web Audio API tesztgombbal, Fejlesztői diagnosztika és gyorsítótár ürítés.
- *Lakói nézet*: Nem admin lakó esetén a saját lakás adatai és elérhetőségei jelennek meg, valamint a dedikált **Biztonság & Hitelesítés** kártya, ahol közvetlenül módosíthatja lakásjelszavát.
- 🔑 **Jelszómódosítás bejelentkezett állapotban (`ChangePasswordModal`)**: A biztonságos újrahitelesítéshez kötelező megadni a **jelenlegi jelszót** (`reauthenticateWithCredential`), majd kétszer az új, **legalább 10 karakteres** jelszót. A jelszó kizárólag a Firebase Authentication rendszerben frissül (zero plaintext tárolás).
- 🛡️ **KK jelszó-visszaállítás megszüntetése (Rule 4 Security)**: A közös képviselő felületéről (`EditFlatMasterModal`) teljes egészében eltávolításra került a lakásjelszó alapértelmezett visszaállítása. Elfelejtett jelszó esetén a lakó a bejelentkező oldalon lévő önkiszolgáló „Elfelejtettem a jelszavam” (`ForgotPasswordModal`, e-mail enumeráció elleni védelemmel) funkciót használja.

### B) Ház-specifikus Beállítások & Banki Integráció (`GlobalBalancesModal.jsx` / `BuildingSettingsModal`)
Minden egyes társasháznak külön banki számlája és egyedi banki API hozzáférése van. Ezek a beállítások az adott házhoz kötődnek:
1. 🏛️ **Épület adatai & Számlák**: Társasház neve, címe, adószáma, bankszámlaszámok (`bankKK`, `bankFA`), egyedi alszámlák hozzáadása/kezelése, valamint az induló tartalékok összegei.
2. 🔌 **Banki API Integráció (Ház-specifikus)**:
   - Szolgáltató kiválasztása (pl. OTP CorpAPI / Open Banking, Erste Bank API, MBH Bank, egyéb PSD2 / Open Banking provider).
   - Környezet (Teszt / Sandbox vs. Éles / Production) és nem titkos Ügyfélazonosító (`clientId`).
   - **Szerveroldali kulcskezelés**: A titkos API kulcs (`Client Secret`) és az mTLS privát kulcs kizárólag a biztonságos backend szerveren (Cloud Secret Manager / KMS) tárolható — soha nem kerül a böngészőbe vagy az ügyféloldali adatbázisba.
   - Napi automatikus számlatörténet- és egyenleg-szinkronizáció kapcsoló.
- **Kényelmes elérési pontok**:
  - `PortfolioView`: Minden társasház kártyáján közvetlenül elérhető a `[ ⚙️ Ház beállításai & Bank ]` gombbal.
  - `AdminView`: A felső kontextus sávban a `[ ⚙️ Ház adatai & Bank ]` gyorsgombbal, valamint a Folyószámlák és Tartalékok kártya `[ Szerkesztés ]` gombjával.

---

## 14. Naptár Ismétlődés és Statikus Lapozás (`CalendarModal.jsx`)
- **Portál dizájnjához illeszkedő lenyíló ismétlődési menü (`isRecurDropdownOpen`)**:
  A naptári eseményrögzítőben a lenyíló menü letisztult, fehér-kék (`#1E3A8A`) világos témában, a Google Calendar logikáját követve jelenik meg:
  1. Nem ismétlődik (`Does not repeat`)
  2. Naponta (`Daily`)
  3. Hetente (adott napon, pl. minden szerdán / `Weekly on Wednesday`)
  4. Havonta a(z) [hanyadik] [hétköznap]on (pl. minden 3. szerdán / `Monthly on the third Wednesday`)
  5. Évente ekkor: [hónap nap] (pl. minden évben november 18. / `Annually on November 18`)
  6. Minden hétköznap (hétfőtől péntekig) (`Every weekday (Monday to Friday)`)
  7. **Egyéni...** (`Custom...`)
  - **Görgethetőség és teljes láthatóság**: A menü belső görgetéssel (`max-h-56 overflow-y-auto`) rendelkezik, valamint az űrlap kártyája (`max-h-[92vh] flex flex-col overflow-y-auto`) biztosítja, hogy a menü és az űrlap alja (pl. az „Egyéni...” opció és a mentés gomb) minden képernyőméreten akadálytalanul elérhető és görgethető legyen.
- **Portál stílusú Egyéni Ismétlődés Modál (`Custom recurrence`, `isCustomRecurOpen`)**:
  Az „Egyéni...” gombra kattintva a honlap dizájnjához tökéletesen illeszkedő, elegáns fehér kártya nyílik meg:
  - **Ismétlés minden / Repeat every**: Számláló (1, 2, 3...) és mértékegység választó (`nap / day`, `hét / week`, `hónap / month`, `év / year`).
  - **Ismétlés napjai / Repeat on**: Hetes egységnél a hét napjait jelképező kerek gombok kék (`#1E3A8A`) fehér betűs kiemeléssel a kijelölt napokon.
  - **Befejezés / Ends**:
    - `(•) Soha / Never`
    - `( ) Ekkor / On`: Dátumválasztó mező.
    - `( ) Ennyi / After`: Számláló és `alkalom után / occurrences`.
  - **Alsó gombok**: Szürke `Mégse / Cancel` és királykék `Kész / Done` akciógomb.
  - Az egyéni ismétlődés matematikai kiértékelését a `countOccurrencesUpTo` és `isEventOnDate` motor végzi el a naptár összes nézetében.
- **Statikus napi lapozó nyilak**:
  - A napi nézet fejlécében a `[ < ]` és `[ > ]` gombok a bal szélre kerültek a „Vissza a havi nézethez” gomb elé, pixelpontosan megegyezve a havi nézet nyilaival. Ennek köszönhetően a lapozó gombok pozíciója teljesen statikus marad, nem ugrik el a napok váltásakor sem.
  - Dupla kattintással bármely esemény részletes nézete megnyitható, és ott egy kattintással szerkeszthető vagy törölhető.
- **Laptop Képernyőre Illesztés & Egysoros Társasház- és Dátumnavigációs Sáv**:
  - A külön egész sort elfoglaló társasházválasztó eltávolításra került a fejlécből. Helyette a `Társasház:` szűrő közvetlenül a dátumnavigációs sáv jobb oldalán, a kiválasztott dátummal egy sorban helyezkedik el.
  - A navigációs sáv vékonyabb (`py-1.5 px-3`), a naptárrács dinamikus és rugalmas magasságú (`auto-rows-fr`, `min-h-[44px] - min-h-[62px]`), így laptopképernyőn (1366x768, 1440x900, 1080p skálázással) is teljes egészében elfér vertikális görgetés nélkül.

---

## 11. Banki Tranzakciók Intelligens Importáló és Jóváhagyó Modulja (`BankImportModal.jsx`, `bankParsers.js`)

- **Elhelyezés és Hozzáférés**:
  - Az aktív társasház felületén a „A ház pénzügyi helyzete” (`FinancialSituationModal.jsx`) menüpontban érhető el egy jól látható, figyelemfelkeltő sávban, valamint a fejlécben található `[ 📂 Banki importálás / Excel feltöltés ]` gombbal.
  - **Házszintű alapértelmezett bank**: Az ablak megnyitásakor a KK kiválasztja a társasház bankját (pl. OTP Bank HTML/XLS/XLSX). A rendszer ezt elmenti az adott épület adatai közé (`building.defaultBank`), így a jövőben automatikusan ez a bank lesz kiválasztva.
- **OTP Bank HTML / XLS és Excel Parser (`bankParsers.js`)**:
  - Az OTP internetbankból letöltött `.xls` valójában HTML táblázat, amelyet a modul kliensoldali `DOMParser` segítségével parse-ol.
  - Támogatja a valódi `.xlsx` és `.csv` fájlokat is a SheetJS könyvtáron keresztül.
  - Kinyeri a fejléc adatokat: Számlaszám, Számla elnevezése (pl. "Közös költség (KK)"), Lekérdezési időszak.
  - Normalizálja a magyar összegformátumokat és dátumokat ISO formátumra (`YYYY-MM-DD`).
- **Smart Matching Motor**:
  - Többszintű duplikáció-szűrés: banki tranzakció azonosító (`bankTxId`) és összetett kulcs (`date + amount + flatNum + targetAccount`) alapján.
  - Lakásbeazonosító pontozó algoritmus (bankszámlaszám, tulajdonos/bérlő név, közlemény lakásszám-minták: "Fsz 2", "2. lakás", "ajtó 2", előírás-összeg egyezés).
  - Alszámla felismerés: Közös Költség vs. Felújítási Alap a számla neve és közlemény kulcsszavai alapján.
  - `Verified` státusz: Nagy pontosságú, pozitív egyenlegű jóváírások azonnal lekönyvelhetők 1 kattintással (`[ ✅ Ellenőrzött tételek könyvelése ]`).
- **Függő Tételek Jóváhagyása (Review Wizard)**:
  - Interaktív lépésről lépésre haladó varázsló a nem egyértelmű vagy vitatott tételekhez.
  - Megjeleníti a banki közleményt, összeget, dátumot és partnert.
  - A KK interaktívan kiválaszthatja a lakást, az alszámlát (KK/FA), a típust (Befizetés / Kiadás) vagy kategóriát, és 1 kattintással jóváhagyhatja (`[ ✅ Jóváhagyás és Könyvelés ]`), ami azonnal rögzíti a tételt a könyvelésben és frissíti a lakás egyenlegét.
  - A tételek kihagyhatók (`[ Kihagyás ]`) vagy szerkeszthetők.
- **Kétnyelvűség és Adatbiztonság**:
  - Minden szöveg, gomb, hibaüzenet és szűrőfelirat megtalálható magyarul és angolul a `src/constants/translations.js` fájlban.
  - Kliensoldali biztonságos DOM-parsing, nincsenek külső szerverre küldött nyers banki adatok.

---

## 12. Nagyvállalati Portfólió Skálázhatóság (100+ Társasház) & Lista Nézet (`PortfolioView.jsx`)

- **Kompakt KPI Jelvények a Fejlécben**:
  - A korábban külön nagy kártyákban lévő mutatók helyett közvetlenül a „Társasházaim” cím mellett jelenik meg két diszkrét kapszulajelvény:
    - `[ 🏢 Kezelt társasház: N ]`
    - `[ 📑 Összes lakás: M ]`
  - Megszűnt a feleslegesen sok helyet foglaló külön kártyasor.
- **Alapértelmezett Lista Nézet (`viewMode: 'list'`)**:
  - Nagyobb, 100+ társasházat kezelő cégeknél a csempés nézet helyett a kompakt, sűrű táblázatos lista nézet az alapértelmezett.
  - Oszlopok: Társasház / Cím, Adószám, Lakások száma, Számlavezető bank, Összesített tartalékok (KK és FA bontással), Lakói hátraléki státusz, Műveleti gombok (Megnyitás, Naptár, Beállítások).
  - Sorra kattintva vagy Entert nyomva közvetlenül megnyílik az adott épület.
- **Nézetváltó kapcsoló**:
  - A keresősáv mellett elérhető a `[ ☰ Lista ]` és `[ ⊞ Csempe ]` kapcsoló, így a felhasználó bármikor visszaválthat a kártyás megjelenítésre is.

---

## 13. Lakások Lista és Csempe Nézete (Skálázhatóság Épületen Belül)

- **Adminisztrátori Egyenleg Mátrix (`AdminView.jsx`)**:
  - Bevezetésre került a nézetválasztó kapcsoló: `[ ☰ Lista ]` és `[ ⊞ Csempe ]`.
  - **Alapértelmezett Lista Nézet (`flatViewMode: 'list'`)**:
    - Nagyobb, 50–100+ lakásos társasházaknál áttekinthető, kompakt táblázatban jelennek meg a lakások.
    - Oszlopok: Albetét/Lakás (státusz pöttyel: piros hátralék esetén, zöld ha rendezett), Tulajdonos (és bérlő ha van), KK egyenleg, FA egyenleg, egyedi számlák egyenlegei, Összegyenleg (színkódolt kapszula: piros/zöld/kék), Gyorsbefizetés gombok (`+KK`, `+FA`, egyedi számlák egyetlen kattintással), Műveletek (Szerkesztés/Törlés mód vagy adatlap megnyitása).
    - Sorra kattintva azonnal megnyílik a lakás részletes kartonja (`onOpenFlatDetail`).
  - **Csempe Nézet (`flatViewMode: 'grid'`)**: A klasszikus kártyás megjelenítés egyetlen kattintással bármikor visszakapcsolható.

- **Lakások Törzsadatai Modal (`FlatsDataModal.jsx`)**:
  - Hasonlóan bekerült a `[ ☰ Lista ]` és `[ ⊞ Csempe ]` váltókapcsoló az összefoglaló fejlécbe.
  - A lista nézetben kompakt táblázat mutatja a lakásszámot, tulajdonost, elérhetőségeket (email, telefon), lakók számát, alapterületet és tulajdoni hányadot, mellékterületeket (garázs, tároló), valamint gyorselérést a pénzügyi adatlaphoz és a törzsadat-szerkesztőhöz.

---

## 14. OTP Bank Open Banking & mTLS Integrációs Modul (`server/`)

- **Kulcsok és Tanúsítványok Elhelyezése (`server/certs/`)**:
  - `server/certs/otp_private.key`: RSA 4096 bites privát kulcs.
  - `server/certs/otp_cert.pem`: X.509 PEM tanúsítvány 10 éves (3650 napos) érvényességgel (2026–2036).
  - `server/certs/otp_public.pem`: Nyilvános kulcs kinyerve a banki regisztrációhoz.
  - `.gitignore`: szigorúan védi a teljes `server/certs/` mappát és az összes kulcsfájlt (`*.key`, `*.pem`, `*.crt`, `*.csr`, `*.pfx`, `*.p12`, `.env`).
- **Környezeti Változók (`.env` és `.env.example`)**:
  - `PORT=5001`, `OTP_API_BASE_URL`, `OTP_AUTH_URL`, `OTP_CLIENT_ID`, `OTP_CLIENT_SECRET`, `OTP_CERT_PATH`, `OTP_KEY_PATH`, `INTERNAL_API_SECRET`.
- **Node.js Kliens Modul (`server/otpApiClient.js`)**:
  - `parseCertificatesFromPem()`: Többrészes PEM láncból kinyeri az összes X.509 tanúsítványt szerepkörökkel (Root CA, Intermediate CA, Kliens tanúsítvány).
  - `validateOtpCertificateChain()`: Ellenőrzi az **OTP Bank Szabályzat 3.1.1** pontja szerinti szigorú láncsorrendet: 1. Root CA, 2. Intermediate CA (ha van), 3. Kliens tanúsítvány.
  - `reorderOtpCertChain()`: Automatikusan átrendezi a tetszőleges sorrendű tanúsítványokat a kötelező OTP 3.1.1 sorrendbe.
  - `validateLocalCertificates()`: Ellenőrzi a fájlok létezését a `server/certs/` könyvtárban, a lánc hierarchiáját és a privát kulcs / kliens tanúsítvány matematikai összetartozását (SHA-256 tesztaláírással).
  - `createOtpMtlsAgent()`: Kölcsönös TLS (mTLS) HTTPS Agent TLS 1.2+ minimumverzióval a banki PSD2 követelményeknek megfelelően.
  - `sendOtpRequest()`: Kérések küldése X-Request-ID fejléccel és mTLS kézfogással.
  - `getOtpOAuthToken()`: OAuth2 Client Credentials tokenlekérés.
  - `getOtpAccounts()` és `getOtpTransactions()`: Számlák és tranzakciók lekérése.
  - `normalizeOtpTransaction()`: OTP CAMT.052 / JSON formátumú tételek konvertálása a TarsasApp egységes pénzügyi tranzakciós sémájára (helyes CRDT/DBIT előjelkezeléssel).
  - `syncBuildingTransactions()`: Társasház szintű szinkronizáció éles mTLS-sel vagy hiteles Sandbox tesztadatokkal.
- **Hivatalos Integrációs Útmutató és E-mail Sablon (`OTP_INTEGRATION_STEPS.md`)**:
  - Teljes 6 fázisú ellenőrzőlista a banki csatlakozáshoz.
  - Hivatalos e-mail sablon a `corpapisupport@otpbank.hu` címre cégnévvel, technikai kapcsolattartóval, ujjlenyomattal és a csatolandó publikus tanúsítványlánccal.
  - Electra Kiegészítő Megállapodás benyújtási lépései és `.env` konfiguráció.
- **Backend API Szerver (`server/server.js`)**:
  - Indítás: `npm run server` (port: 5001).
  - `GET /api/health`: Szerver és tanúsítvány-érvényesség ellenőrzés.
  - `GET /api/bank/certs/status`: X.509 metaadatok biztonságos lekérdezése.
  - `POST /api/bank/sync/:buildingId`: Tranzakciók szinkronizálása az adott társasházhoz.
  - `POST /api/bank/test-connection`: Élő mTLS kézfogás tesztelése a banki szerverrel.
- **Frontend Integráció (`BankImportModal.jsx`)**:
  - Közvetlen `[ 🔄 OTP Corporate API Szinkronizálás (mTLS) ]` gomb a modalban, amely meghívja a backend végpontot és az eredményt azonnal átadja a Smart Matching és Review Wizard motornak.

---

## 15. Dokumentum Mapparendszer és Intuitív Fájlkezelés (`DocumentsModal.jsx`)

A társasházi irattár fejlett, minden korosztály számára könnyen és intuitívan használható mapparendszerrel és fájlkezeléssel bővült:
1. 📁 **Mapparendszer (`docFolders`)**:
   - **Mappa létrehozása**: `[ + Új mappa ]` gomb, egyedi név és 6 választható színkód (Kék, Borostyán, Zöld, Indigó, Lila, Piros).
   - **Mappa átnevezése és törlése**: Bármely mappa átnevezhető. Törlés esetén a benne lévő dokumentumok automatikusan és biztonságosan a főkönyvtárba kerülnek át, megelőzve az adatvesztést (Rule 3 & Rule 4).
   - **Kenyérmorzsa navigáció**: `[ 🏠 Főkönyvtár ] > [ 📁 Mappa Neve ]` kattintható útvonalsáv és 1-kattintásos visszalépés.
   - **Mappa számlálók**: Minden mappán látható a benne lévő dokumentumok pontos darabszáma.
2. ✏️ **Dokumentumok szerkesztése és Fájlcsere (`updateDocument`)**:
   - Dokumentum címének és fájlnevének módosítása.
   - **Célmappa áthelyezés**: Lenyíló listából vagy gyors áthelyező modálból bármelyik mappába (vagy vissza a főkönyvtárba) azonnal átmozgatható.
   - **Fájl megváltoztatása / cseréje**: Új fájl kiválasztása, amely felülírja a korábbi bináris tartalmat a `condo_files/` felhőtárhelyen, frissítve a fájlméretet és típust.
3. 🖱️ **Maximális Ergonómia Minden Korosztálynak**:
   - **Natív Jobbklikk Kontextus Menü**:
     - Mappán: Megnyitás, Átnevezés, Törlés.
     - Dokumentumon: Letöltés, Szerkesztés / Fájlcsere, Áthelyezés mappába, Törlés.
     - Üres területen: Új mappa létrehozása, Új dokumentum feltöltése.
   - **Kijelölés & Delete billentyű támogatás**: Mappára vagy dokumentumra kattintva az elem kiemelést kap; a `Delete` vagy `Backspace` gomb lenyomására azonnal megnyílik a törlési megerősítő párbeszédablak.
   - **Érintőképernyő és idősebb felhasználók támogatása**: Minden funkció elérhető jól látható, nagy felületű gombokkal és 3-pontos menüvel (`...`) is, nem kötelező az egér jobb gombjának vagy billentyűparancsoknak az ismerete.
   - **Kétnyelvűség és felhőszinkron**: Teljes körű `hu` / `en` szótár- és Firebase RTDB CRDT szinkronizáció.

---

## 16. Albetét Törzsadatai Multi-Tab Rendszer és Intelligens Banki Párosítás (`EditFlatMasterModal.jsx`)

A lakások törzsadatait kezelő felület (`EditFlatMasterModal.jsx`) és a hozzá kapcsolódó albetét-adatmodell egy professzionális, tágas 5-füles rendszerré alakult át az alábbi architektúrával:

1. 📐 **UX / UI Ergonómia és Elrendezés**:
   - **Tágas modál**: Kibővítve nagy méretű nézetté (`max-w-5xl`, `h-[88vh]`), megszüntetve a korábbi szűk, zsúfolt elrendezést.
   - **Rögzített (Sticky) Fejléc és Fülsor**: Az albetét neve, típusa, aktív bérlő jelzője, szerkesztés/mentés/mégse gombok és a 4 fül mindig rögzítve marad felül; csak az aktuális fül tartalma görgethető külön.
   - **ESC Billentyű és Háttér Kezelés**: Globális `keydown` eseményfigyelővel a felugró ablak azonnal és kényelmesen bezárható az `Escape` billentyű lenyomására vagy a háttérre kattintva.

2. 🏷️ **Önálló Albetét Típusok (`unitType`)**:
   - A rendszer nemcsak lakásokat, hanem önálló albetétként kezelt egyéb egységeket is támogat:
     - `flat`: Lakás (`Home`)
     - `garage`: Garázs / Beálló (`Car`)
     - `storage`: Tároló / Pince (`Package`)
     - `commercial`: Üzlethelyiség / Iroda (`Briefcase`)
     - `other`: Egyéb (`Layers`)
   - **Fő listanézet (`FlatsDataModal.jsx`)**: Színes típus-jelvényekkel, aktív bérlő címkével, valamint gyorsszűrő gombokkal (`Mind`, `Lakások`, `Garázsok`, `Tárolók`, `Üzlethelyiségek`, `Egyéb`).

3. 📑 **A 4 Logikus Fül (Multi-Tab Struktúra)**:
   - **A) "Alapadatok" (`tab_flat_basic`)**: Albetét típusa, kódja, helyrajzi szám (`hrsz`), lépcsőház, emelet, ajtó, alapterület (m²), légköbméter (m³), tulajdoni hányad (%), lakók száma (fő), egyedi utaláskód (`paymentCode`), vételi és eladási időpontok, jogi személy jelölő (`isCompany`), rezsiből kihagyva (`excludeUtility`), valamint szabad szöveges megjegyzések.
   - **B) "Tulajok / Bérlők" (`tab_flat_owners_tenants`) - Egységesített Tulajdonosi és Bérlői Nyilvántartás**:
     - **Kompakt lista + Rákattintásra lenyíló (Accordion) részletek**: Alapértelmezésben tiszta, átlátható listanézet látható (név, szerepkör-jelvény, tulajdoni hányad, elsődleges kapcsolattartó csillag, e-mail cím és telefonszám).
     - Rákattintva az elem azonnal lenyílik, megjelenítve a részletes szerkesztőmezőket, levelezési címet, bérleti időszakot és ismert számlaszámokat.
     - **"Összes kibontása / Összecsukása" gyorsgomb**: Egyszerre nyitja vagy zárja az összes kártyát.
     - **Gyorsszűrő gombsor a fülön belül**: `Mind`, `Tulajdonosok`, `Bérlők`.
     - **Megbízható, kattintható kapcsolók (Checkboxes)**: Gomb-alapú pipák az elsődleges kapcsolattartó, e-mail értesítés, SZVB tagság és bérlő aktív státusz kezelésére. A felesleges "Banki utaló" jelölő eltávolítva.
     - **Tulajdonosok és bérlők megkülönböztetése**: Kék/indigó téma a tulajdonosoknak (szerepkörök, tulajdoni hányadok valós idejű összegezésével), smaragdzöld téma az aktív bérlőknek, szürke téma a korábbi bérlőknek.
   - **C) "Mérőórák" (`tab_flat_meters`)**:
     - Albetéti mérőórák (Hideg víz, Meleg víz, Fűtés, Villany, Gáz, Egyéb).
     - Gyári szám, beszerelés és leszerelés dátuma/állása, aktuális állás, utolsó leolvasás dátuma, hitelesítés lejárata.
     - **Automatikus lejárati figyelmeztetés**: piros badge lejárt hitelesítésre, narancssárga badge 180 napon belüli lejárathoz.
   - **D) "Tartozékok" (`tab_flat_annexes`)**:
     - Nem önálló albetétként kezelt tartozékok (beálló m², tároló db, terasz m², vízátalány).
     - Kód, megnevezés, mennyiség, mértékegység (`db`, `m²`, `m³`, `Ft`). Visszamenőlegesen kompatibilis a korábbi `garages` és `storages` struktúrákkal.

4. 🧠 **Smart Matching Integráció (`bankParsers.js`)**:
   - A banki tranzakció-párosító motor kibővítve az új azonosítókkal:
     1. `flat.paymentCode` / `flat.utalaskod`: 85 pontos prioritású egyezés a közleményre.
     2. Minden tulajdonos/haszonélvező neve és megadott bankszámlaszáma automatikusan felismeri a partnert.
     3. Csak az aktuálisan **aktív** bérlők neve, utaló neve és számlaszáma kerül be a felismerési kulcsok közé (a már kiköltözött bérlők kizárva).

---

## 17. Oldalfrissítés (F5 / Reload) és Munkamenet Állapotmegőrzés (`src/App.jsx`)

Az alkalmazás mostantól képes megőrizni az éppen megnyitott nézeteket, modálokat és aktív albetéteket a böngésző oldalfrissítése (`F5`, `Ctrl+R` vagy böngésző újratöltés) során:

1. 🔄 **Megőrzött állapotok & Rétegződés**:
   - **Albetét Adatlapja (`FlatDetailModal`)**: Ha a felhasználó pl. az 1-es lakásban dolgozott (`flatDetailNum = '1'`), frissítés után azonnal újra megnyílik az 1-es lakás részletes adatlapja (`#flat=1`).
   - **Törzsadat Nézet (`EditFlatMasterModal`)**: Ha a törzsadat ablakban volt (`#master=1`), újratöltéskor a teljes 4 füles szerkesztőablak jelenik meg újra.
   - **Rétegzett Megnyitás**: Ha a felhasználó a "Lakások adatai" felületről (`isFlatsDataOpen`) nyitotta meg az albetétet, frissítéskor mindkét modál megfelelően feláll; az albetét bezárásakor a felhasználó a "Lakások adatai" listanézetbe tér vissza.
   - **Egyéb Fő Modálok**: Pénzügyi helyzet (`#view=finance`), Dokumentumok (`#view=docs`), Közgyűlések (`#view=assembly`), Kölcsönök (`#view=loans`), Naptár (`#view=calendar`), Alapok & Beállítások (`#view=balances`), Profil (`#view=profile`).

2. 🛡️ **Technikai architektúra**:
   - `sessionStorage["tarsas_nav_state"]`: Biztonságos, fül-specifikus perzisztencia, amely nem szivárog át új böngészőlapokra vagy más bejelentkezésekhez.
   - `window.history.replaceState`: Letisztult URL hash szinkronizáció előzmény-duplikáció nélkül.
   - `window.addEventListener('hashchange')`: Natív támogatás a böngésző Vissza/Előre gombjaihoz.
   - `syncEngine.js` & `authActions.js`: Munkamenet megtartása `sessionStorage["tarsashaz_session_user"]` által frissítéskor, és teljes törlés kijelentkezéskor (`logout()`).

---

## 18. Kettős Görgetősáv Megszüntetése és Mindig Aktív Törzsadat Szerkesztő

1. 🖱️ **Kettős görgetősáv (Double scrollbar) megszüntetése**:
   - A flexbox `min-height: auto` viselkedése miatt a nagyméretű táblázatok túlcsordították a külső szülő konténert, így a böngésző két függőleges görgetősávot jelenített meg egymás mellett (amelyből a külső inaktív volt).
   - Javítás: `overflow-hidden` a külső `fixed inset-0` konténeren, valamint `min-h-0` a belső `flex-1 overflow-y-auto` elemen mind a 6 fullscreen modálban (`FlatsDataModal`, `FinancialSituationModal`, `DocumentsModal`, `LoansModal`, `AssemblyModal`, `ProfileModal`, `FullscreenTxModal`).
   - Eredmény: pontosan egy darab, simán gördülő aktív görgetősáv jelenik meg a jobb szélen.

2. ✏️ **Közvetlen és akadálytalan törzsadat szerkesztés (`EditFlatMasterModal.jsx`)**:
   - Megszűnt az értelmetlen kezdeti passzív zárolás (`isEditMode = false`), a modál a megnyitás pillanatától azonnal szerkeszthető.
   - Minden jelölőnégyzet és kapcsoló (`isCompany`, `excludeUtility`, `isPrimaryContact`, `sendEmailNotification`, `isBoardMember`, `isActive`) 100%-ban interaktív, közvetlenül ki/be pipálható a korábbi `disabled={!isEditMode}` blokkolások eltávolításával.
   - Kiemelt **Mentés** (`<Save />`) és **Mégse** gombok találhatók mind a fejlécben, mind a láblécben; a Mentés elmenti az adatokat és bezárja az ablakot.

---

## 19. Kategóriatörzs, Intelligens Kassza-választás és Fizetési Mód Kezelése a Tranzakciós Modálokban

1. 📂 **Kategória választó és automata kassza-kiválasztás (`UniversalTransactionModal` és `EditTransactionModal`)**:
   - Új `KATEGÓRIA` legördülő mező közvetlenül a `SZÁMLA / ALAP` mellett.
   - Dinamikusan betöltődik az adott ház `categories` kollekciójából (fallback: `DEFAULT_CATEGORIES` a `defaultData.js`-ből).
   - **Típus szerinti automatikus szűrés**:
     - *Befizetés / Jóváírás (+)* módban kizárólag a `type === 'income'` kategóriák érhetők el (pl. Közös költség, Felújítási hozzájárulás, Bérleti díj bevétel).
     - *Kiadás / Terhelés (-)* módban kizárólag a `type === 'expense'` kategóriák érhetők el (pl. Karbantartás, Szemétszállítás, Biztosítás, Lift, Közös áram).
   - **Intelligens kassza-kiválasztás**: Amikor a felhasználó kiválaszt egy kategóriát, a `SZÁMLA / ALAP` mező automatikusan átvált a kategória `defaultFund` értékére (`Közös Költség` vagy `Felújítási Alap`), de a felhasználó manuálisan továbbra is bármikor felülbírálhatja.

2. 💳 **Fizetési mód választó (`Banki átutalás` vs `Készpénz (Pénztár)`)**:
   - Kétállású gombválasztó az új tétel és szerkesztés ablakban.
   - **Okos egyenleg-kezelés**:
     - `Készpénz (Pénztár)` választásakor a rendszer automatikusan kiveszi a pipát a *"Befolyásolja a folyószámla egyenleget?"* mezőből (`affectsBalance = false`), így a készpénzes tételek nem torzítják a társasházi banki egyenleget.
     - `Banki átutalás`-ra visszaváltva automatikusan visszakerül a pipa (`affectsBalance = true`).
     - A jelölőnégyzet ettől függetlenül kézzel bármikor ki- és bekapcsolható marad.
   - **Megjelenítés a tranzakciós listában**:
     - A rögzített fizetési mód (`paymentMethod` és `method`) elmentésre kerül a tranzakcióhoz/kiadáshoz.
     - A "Minden tranzakció és kiadás" listában (`AdminView.jsx`) és a teljes képernyős listában (`FullscreenTxModal.jsx`) a jobb oldali összeg alatt megjelenik: a készpénzes tételek feltűnő borostyán (`bg-amber-100 text-amber-800`) jelvénnyel jelennek meg mint `Készpénz (Pénztár)` / `Cash (Register)`, az átutalások pedig `Banki átutalás` / `Bank Transfer` felirattal.

3. 📐 **Elrendezés, UX és billentyűzet-kezelés (ESC)**:
   - A rövid mezők (Kategória + Számla/Alap, Fizetési mód + Dátum) 2 oszlopos gridbe (`sm:grid-cols-2`) rendeződtek asztali nézetben, így az űrlap kényelmesen, függőleges görgetés nélkül elfér.
   - Megnövelt belső margó és modál szélesség (`max-w-2xl`): az összeg mező felső része garantáltan nem csúszik be a fejléc alá.
   - Globális `Escape` (ESC) billentyűfigyelő és háttérkattintás azonnal bezárja az ablakot.

---

## 20. Kiberbiztonsági Audit & Phase 0 Vészhelyzeti Konténment (2026.11.19)

A teljes körű kiberbiztonsági auditot követően az alábbi Phase 0 biztonsági intézkedések kerültek implementálásra a kódbázisban (éles Firebase/adatbázis módosítás nélkül, Rule 3 betartásával):

1. **PII, Jelszavak és Banki Titkok Teljes Eltávolítása a Kliens Csomagból**:
   - A `src/constants/defaultData.js`, a UI modálok, utility fájlok, szótárak és dokumentációk megtisztítva minden valós lakói névtől, e-mailtől, telefonszámtól, bankszámlaszámtól, plaintext jelszótól, reset tokentől, Base64 PDF-től és hardcoded API kulcstól.
   - `syncEngine.js`: `stripSensitiveUserFields` és `stripSensitiveBuildingFields` szűrők gondoskodnak róla, hogy `pass`, `password`, `resetToken*` és `bankApi.apiKey/clientSecret/secretKey` soha ne kerülhessen a böngésző tárolójába vagy a felhő payloadba.
2. **Szigorú Firebase Auth Hitelesítés és Munkamenet-higiénia**:
   - `authActions.js` & `AppContext.jsx`: Plaintext jelszó-fallback, hardcoded e-mail alias/prefix egyezés és kliensoldali `createUserWithEmailAndPassword` megszüntetve; `ensureFirebaseAuth` kizárólag `auth.authStateReady()`-t használ; `onAuthStateChanged` törli a lejárt lokális cache-t; `logout()` teljes `localStorage`/`sessionStorage`/memória törlést végez.
   - `ChangePasswordModal` + `changePassword(currentPass, newPass)`: Kötelező jelenlegi jelszó újrahitelesítés (`reauthenticateWithCredential`) és legalább 10 karakteres jelszó.
   - `ForgotPasswordModal`: E-mail enumeráció elleni védelem (`auth/user-not-found` egységes nyugtázása, kétnyelvű HU/EN).
3. **Mélységi Jogosultságvédelem (Defense-in-Depth RBAC) és UI Bypass Zárások**:
   - Minden mutáló akció (`buildingActions.js`, `accountingActions.js`, `loanActions.js`, `calendarActions.js`, `updateRepProfile`, `updateGlobalSettings`, `forceSyncLocalToCloud`, `switchToKkMode`) ellenőrzi az `admin`/`superadmin` szerepkört; lakói `saveFlatMaster` kizárólag saját lakásra és `{ phone, emergencyContact, notes }` mezőkre korlátozva.
   - `LoansModal` (`#view=loans`) lezárva `admin`/`superadmin`/`szvb` körre; `FullscreenTxModal` `Ctrl+C`/`Ctrl+V`/`Delete` és `flatNum` szűrése javítva; `CalendarModal` havi cella kattintás nem enged eseményrögzítést nem-adminnak; `AddFlatModal`, `AddBuildingModal`, `UniversalTransactionModal` belső admin őrrel védve; `getUserFlats` alstring-alapú névegyezése eltávolítva.
4. **Banki Backend (`server/server.js`, `server/otpApiClient.js`) és Hosting Fejlécek (`firebase.json`)**:
   - `server/server.js`: `127.0.0.1` alapértelmezett bind, szigorú `ALLOWED_ORIGINS` CORS, `crypto.timingSafeEqual` Bearer token hitelesítés minden `/api/bank/*` végponton, HTTP 413 DoS védelem, `forceMock` tiltva élesben, fájlrendszer-útvonalak (`certPath`/`keyPath`) elrejtve, szanitizált 500 válaszok.
   - `server/otpApiClient.js`: Cache-elt mTLS `https.Agent` (`rejectUnauthorized: true`), szigorú HTTPS + OTP hostname allowlist (SSRF védelem), fail-closed IBAN egyezés (`accounts[0]` fallback törölve), `passphrase` támogatás a kulcspár-ellenőrzésben.
   - `package.json`: `"server": "node --env-file-if-exists=.env server/server.js"`.
   - `firebase.json`: `Strict-Transport-Security`, `Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` hozzáadva.
5. **Jóváhagyott Következő Architektúra (`/plan` fázisban tervezendő élesítés előtt)**:
   - Migráció **Cloud Firestore**-ra (`buildings/{buildingId}/units`, `transactions`, `categories`, `auditLogs`), atomi `runTransaction`, módosíthatatlan `auditLogs` (`allow update, delete: if false;`), szerveroldali lapozás, valamint szigorú Tht./GDPR Firestore Security Rules (**Admin**: teljes R/W; **SZVB**: teljes R/O; **Lakó**: csak saját albetét + házszintű aggregált egyenleg/hátralék, más lakások részletei nélkül).

---

## 21. Phase 1 Cloud Firestore Multi-Tenant Architektúra, Atomic Cloud Functions & Tht./GDPR Izoláció (2026.11.19)

A jóváhagyott migrációs terv alapján elkészült a teljes lokális Cloud Firestore + Cloud Functions v2 + Cloud Storage infrastruktúra és a Tht./GDPR UI elkülönítés (**éles Firebase módosítás nélkül**, Rule 3 szigorú betartásával):

1. **Multi-Tenant Firestore Séma, Szabályok és Indexek**:
   - `firestore.rules`: Tht./GDPR-kompatibilis RBAC szabályok `buildings/{bId}/members/{uid}` + `superadmin` Custom Claim alapon.
     - **Admin**: Épületszintű olvasás és nem-pénzügyi törzsadat írás; minden pénzügyi írás Option A szerint szerveroldali Cloud Functionön (`allow write: if false;` a kliensnek).
     - **SZVB**: Teljes épületszintű csak olvasási (`read-only`) jogosultság (`units`, `transactions`, `MonthlyDetailModal`, `LoansModal`, `auditLogs`).
     - **Lakó (`Owner`)**: Saját albetét (`uid in ownerUids`) + saját kontaktmezők (`phone`, `emergencyContact`, `notes`) szerkesztése + házszintű tartalékok és **aggregált hátralékösszeg** (`buildings/{bId}`, `monthlySummaries`) + házszintű kiadások (`visibility == 'building'`) + saját albetét tranzakciói (`accessFromDate` tulajdonosváltási adatvédelmi szűrővel). Más lakások, tulajdonosnevek, hitelek és audit naplók szigorúan tiltva.
     - **`auditLogs`**: Szigorúan módosíthatatlan (`allow update, delete: if false;`).
   - `firestore.indexes.json`: Kompozit indexek 50 tétel/oldal szerveroldali lapozáshoz (év, hónap, `unitId`, `visibility`, `ownerUids`).
   - `storage.rules`: Épület- és tranzakció-izolált Cloud Storage szabályok (max 5–10 MB, biztonságos MIME whitelist).
   - `firebase.json`: Firestore, Storage, Functions és helyi Emulator Suite (`auth: 9099`, `firestore: 8080`, `functions: 5001`, `storage: 9199`, `ui: 4000`) regisztrálva.
2. **Option A Atomi Cloud Functions v2 Motor (`functions/`)**:
   - `functions/src/financeMath.js`: Determinisztikus egyenleg-, banki tartalék-, O(1) hátralék-delta és havi díjszámító motor (100% paritásban a `src/utils/finances.js`-sel).
   - `functions/src/transactions.js`: `mutateTransaction` (`create`/`update`/`delete`) és `calibrateBuildingBalances` egyetlen atomi `runTransaction`-ben (tranzakció + albetét egyenleg + ház KK/FA & hátralék aggregátum + `monthlySummaries` + módosíthatatlan `auditLog`).
   - `functions/src/assessments.js`: `scheduledMonthlyAssessments` (minden hónap 1-jén 00:05 CET) és `triggerMonthlyAssessments` idempotens havi előírás-materializálással (`assess_YYYY-MM_unitId_fund`).
   - `functions/src/members.js` & `functions/src/loans.js`: `provisionBuilding`, `manageBuildingMember`, `manageUnitLifecycle`, `mutateLoan` (utóbbi szinkronizálja kizárólag az adott albetét `activeLoanShares[]` szeletét).
3. **Frontend Firestore Service & Azonnali GDPR UI Védelem**:
   - `src/constants/firebaseConfig.js`: `db` (Firestore), `functions`, `storage` inicializálás + helyi emulátor csatlakozás (`VITE_USE_EMULATORS=true`).
   - `src/services/firestoreService.js`: Szerepkör-szűrt GDPR lekérdezések, 50/oldal lapozás, Cloud Functions `httpsCallable` hívások, Storage letöltés.
   - `FinancialSituationModal.jsx` & `MonthlyDetailModal.jsx` & `TenantView.jsx`: Lakók kizárólag a társasház összesített hátralékát (aggregált kártya), a közös kiadásokat, saját befizetéseiket és saját hitelrészvételüket (`activeLoanShares`) látják; más lakások egyenlegei/nevei elrejtve; melléklet `href` XSS-szanitizálva; új kétnyelvű kulcsok (`hu`/`en`) a `translations.js`-ben.
4. **Migrációs Eszközök & Automatizált Tesztek**:
   - `scripts/rtdbToFirestoreTransform.js`, `scripts/migrateRtdbToFirestore.mjs` (Emulator alapértelmezett + szigorú Rule 3 prod zár), `scripts/verifyMigrationParity.mjs` (0 Ft eltérés-ellenőrző).
   - `tests/atomicTransactions.test.mjs` (`npm run test:atomic`) és `tests/firestore.rules.test.mjs` (`npm run test:rules`).

---

## 23. Tapadó Havi Fejlécek és Csoportosított Listanézetek (`StickyMonthGroup`, `dateGrouping.js`)

A portál tranzakciós és könyvelési listáiban (mind az Összes tétel / Lakás előzmények teljes képernyős modálban (`FullscreenTxModal.jsx`), mind az Adminisztrátori műszerfal tranzakciós táblázatában (`AdminView.jsx`)) a havi elhatároló fejlécek tapadó (`position: sticky`) módon működnek:

1. **Önálló Wrapper `<section>` elemek (`StickyMonthSection`)**:
   - A tételek nem egy lapos listaként renderelődnek, hanem hónaponként külön `<section className="month-group divide-y divide-gray-100 relative">` konténerekbe vannak csoportosítva (`groupItemsByMonth(items, isEn)`).
   - Ennek köszönhetően, amikor az alsóbb hónap fejléce felér az aktuális havi fejléchez, a böngésző natív CSS sticky viselkedése révén a következő hónap természetesen és simán kitolja felfelé az előzőt.

2. **Átlátszatlan, Frosted-Glass Fejléc és Rétegrend (`StickyMonthHeader`)**:
   - A tapadó fejléc `bg-gray-100/95 sm:bg-gray-50/95` átlátszatlan/félig áttetsző hátteret, `backdrop-blur-md` elmosást, diszkrét `border-y border-gray-200/90` keretet és `shadow-2xs` árnyékot kap.
   - `z-index`: `z-10`, így a lista görgetett elemei soha nem látszódnak át alatta, de a felső navigációs fejléc (`z-30`) és a modálok/menük (`z-40`, `z-50`) alatt marad.

3. **Szülő Kártyák `overflow: hidden` Védelme**:
   - A szülő kártyákon a `position: sticky`-t blokkoló `overflow: hidden` eltávolításra került. A lekerekített sarkok tökéletes illeszkedését a legelső csoport fejlécének `first:rounded-t-2xl` formázása és az alsó elemek sarkainak lekerekítése biztosítja.

4. **Dinamikus Fejléc Magasság Követés (`--app-header-height`)**:
   - A `Header.jsx` komponens `ResizeObserver` segítségével dinamikusan beállítja a `--app-header-height` CSS változót a `document.documentElement` gyökérelemen.
   - Teljes oldalas nézetekben (`AdminView`) a fejléc `top: var(--app-header-height, 61px)` és `top-[57px] sm:top-[61px]` pozícióval pontosan a fix fejléc alá tapad, nem csúszik be alá impersonation esetén sem.
   - Modálos belső görgetésnél (`FullscreenTxModal`) a `topOffset="modal"` (`top-0`) érvényesül.

5. **Kétnyelvűség és Egységtesztek**:
   - Magyar: `2026. NOV.`, `2026. OKT.`, `EGYÉB`
   - Angol: `NOV 2026`, `OCT 2026`, `OTHER`
   - Tesztcsomag: `tests/dateGrouping.test.mjs` (`npm run test:grouping`).

---

## 24. Teljes Nézetes Kommunikációs & E-mail Központ és Képletezhető Felszólítási Szabálymotor (`CommunicationCenterModal`, `dunningRules.js`)

A rendszer jobb felső sarkában található Értesítési / E-mail felület kibővült egy teljes nézetes irányítóközponttal és egy automatizálható felszólítási szabállyal rendelkező motorral (Dunning Rules Engine):

1. **Teljes Képernyős Kommunikációs Központ (`CommunicationCenterModal.jsx`)**:
   - A fejléc értesítési lenyílójában (`NotificationBell.jsx`) egy új Nagyítás (`Maximize2`) ikon és lábléc gomb érhető el, amellyel egy kattintással megnyitható a teljes képernyős felület.
   - Jobb felső sarokban `X` és `Esc` billentyű támogatás az azonnali bezáráshoz és az előző nézetbe való visszatéréshez.
   - Három fő munkaterület / fül:
     1. **Értesítések & Rendszerüzenetek**: Rendszerfigyelmeztetések, banki változások és meghívók szűrése épületenként vagy globálisan.
     2. **Felszólítási Szabályok (Dunning Engine)**: Automatikus emlékeztető és felszólító szabályok konfigurálása.
     3. **Kiküldési Napló & Várólista**: Generált és szimulált levelek listája, állapota, időbélyege és levélelőnézete.
   - Portfólió nézetből megnyitva minden kezelt házat egyben kezel, háznézetből megnyitva pedig az adott társasházra szűr, de a fejlécben található társasház-választóval bármikor váltható.

2. **Képletezhető Felszólítási Szabálymotor (`src/utils/dunningRules.js`) és Automatikus Reggel 8:00-i Kiküldés**:
   - **Egyenlegtípus szűrés**: Közös költség (`KK`), Felújítási alap (`FA`) vagy Összesített hátralék (`ALL`, `per_account`).
   - **Feltétel- és küszöbérték képletek**:
     - *Havi hátralék küszöb*: Az elmaradt havi előírások hányadosa (`debt / monthlyFee`), pl. >= 1 hó emlékeztető, >= 3 hó fizetési felszólítás, >= 6 hó jogi eljárás előtti figyelmeztetés.
     - *Minimum Ft küszöb*: Megadott forintösszeg feletti hátralékok (pl. >= 10 000 Ft).
     - *Kombinált logika*: `OR` (vagy a havi elmaradás, vagy a forintösszeg teljesül) vagy `AND` (mindkét feltételnek teljesülnie kell).
   - **Automatikus Reggel 8:00-i Kiküldés (Europe/Budapest)**:
     - Futási nap beállítása (`checkDayOfMonth`, pl. minden hónap 24-én). A felhasználói felületen és a motorban ez determinisztikusan a **reggel 08:00-i kiküldést** jelenti.
     - Kettős (felhő- és kliensoldali) ütemezés:
       - *Kliensoldali scheduler (`AppContext.jsx`, `executeAutomatedDunningDailyCheck`)*: Amikor az adminisztrátor be van jelentkezve, 60 másodperces ellenőrzési ciklussal észleli a fordulónap 08:00 óráját, lefuttatja a vizsgálatot, és automatikusan elküldi a leveleket a Resend API-n keresztül.
       - *Szerveroldali felhő scheduler (`functions/src/dunning.js: scheduledDailyDunningEmails`)*: Minden nap 08:00-kor (Budapest időzóna szerint) a Cloud Scheduler önállóan is lefut.
     - *Napi idempotencia védelem*: A szabály `lastAutoDispatchedDate` mezője (`YYYY-MM-DD`) és az `emailOutbox` bejegyzések garantálják, hogy ugyanazon a napon soha ne menjen ki kétszer értesítés.
     - Ismétlési védelem (`cooldownDays`, pl. 25-30 nap) és kereszt-türelmi védelem (`crossRuleCooldown`), amely megakadályozza a duplikált kiküldést ugyanabban a számlázási ciklusban.
   - **Kiküldési Csatornák Kiválasztása (`sendEmail`, `sendInApp`)**:
     - Minden szabályban külön-külön ki- és bekapcsolható a két független értesítési csatorna:
       - ✉️ **E-mail küldése**: Hivatalos tranzakciós e-mail kiküldése a lakó e-mail címére a Resend API-n keresztül.
       - 🔔 **Appon belüli értesítés**: Belső figyelmeztető és felszólító rendszerértesítés a lakói portál felületén (`notifications`).
       - Akár mindkettő, akár csak az egyik csatorna önállóan is választható; a szabályszerkesztő validációja megköveteli, hogy legalább az egyik be legyen jelölve.
   - **Dinamikus sablonkezelő & Merge tagek**:
     - Változók beillesztése: `{{tulajdonos_neve}}`, `{{lakas_szam}}`, `{{hatralek_osszeg}}`, `{{hatralek_honapok}}`, `{{alapterulet}}`, `{{tarsashaz_neve}}`, `{{szamlaszam}}`, `{{kozlemeny}}`, `{{fizetesi_hatarido}}`, `{{kepviselo_neve}}`, `{{kepviselo_telefon}}`, `{{kepviselo_email}}`, `{{datum}}`.
     - Változó beillesztő chipek a szerkesztőben a könnyű kattintásos sablonépítéshez.

3. **Valósághű Sablon-Előnézet és Száraz Teszt (`generateSampleFlatPreview`)**:
   - A szabályszerkesztőben a korábbi száraz teszt táblázat helyett a felhasználó kérésének megfelelően a **"3. Előnézet"** fül kapott helyet, amely egy teljes, formázott e-mail kliens borítékot és levéltörzset mutat be.
   - **Véletlenszerű vagy konkrét lakás előnézete**: A képviselő a "Másik lakás" (`Shuffle`) gombbal vagy a legördülő lakásválasztóval bármikor válthat a ház albetétei között.
   - **Valósághű szimuláció**: Ha a választott lakásnak épp nincs a szabályt elérő valós hátraléka (pl. naprakész a befizetése), a motor automatikusan a szabály küszöbéhez illeszkedő életszerű teszt-hátralékot generál, így a dinamikus tagek (`{{hatralek_osszeg}}`, `{{hatralek_honapok}}`, `{{lakas_szam}}`, `{{tarsashaz_neve}}`, stb.) azonnal kitöltődnek, és a képviselő rögtön látja, hogyan néz ki a levél a valóságban a lakó postaládájában.
   - A Kommunikációs Központ fő felületén a "Száraz teszt futtatása" funkció továbbra is elérhető a teljes adatbázisra kiterjedő tömeges kiértékelésre.

4. **Kiküldési Várólista & API Integrációs Előkészítés**:
   - A száraz teszt eredményei vagy a manuálisan jóváhagyott tételek átkerülnek az `emailOutbox` várólistába.
   - Készen áll a külső e-mail szolgáltatók (pl. SendGrid, Mailgun, Brevo, Firebase Extension) közvetlen API bekötésére.

5. **Adatperzisztencia és Biztonság**:
   - `src/context/emailActions.js`: Reducer és state műveletek (`saveEmailRule`, `deleteEmailRule`, `toggleEmailRule`, `queueOutboxItems`, `clearOutboxItems`, `executeAutomatedDunningDailyCheck`).
   - `src/context/syncEngine.js`: `emailRules` és `emailOutbox` integrálva a helyi perzisztenciába és a felhőszinkronba.
   - Szerepkör alapú hozzáférés: Lakók nem férhetnek hozzá a felszólítási motorhoz, csak adminisztrátorok és kijelölt képviselők.

6. **Automatizált Egységtesztek**:
   - `tests/dunningRules.test.mjs` (`npm run test:dunning`): 21 determinisztikus teszt fedi le a sablonbehelyettesítést, a pozitív/nulla egyenlegek kizárását, a havi arányszámítást, a kombinált logikát, a cooldown védelmet, a többházas száraz tesztet, a valósághű minta lakás előnézet-generálást, a budapesti időzóna-számítást, a reggel 8:00 előtti blokkolást, az automatikus reggel 8:00-i kiküldést, az idempotencia védelmet és a független kiküldési csatorna-kezelést (e-mail, appon belüli vagy mindkettő).

---

## 25. Céges Elérhetőség, Házkezelői Profil és Tulajdonosi Eszkalációs Csatorna (`resolveBuildingResidentContact`, `ProfileModal`, `TenantView`)

A közös képviseleti cégadatok és a kijelölt házkezelő kollégák elérhetőségeinek kezelése egységes, hierarchikus architektúrát kapott, megszüntetve az adatduplikációt és a hatásköri keveredést:

1. **Minden Profiladat a Fiók / Rendszerbeállításokban (A Opció: 4 Dedikált Fül)**:
   - **Fiók / Rendszerbeállítások (`ProfileModal.jsx`)**: Minden profil jellegű adat egyetlen átlátható beállítási központban kapott helyet 4 füllel:
     1. 👤 **Személyes profil** (`personal`): Saját név, közvetlen telefonszám, közvetlen e-mail, saját fogadóóra/elérhetőségi idő. (Munkatársaknál központi cégjelvénnyel).
     2. 🏢 **Céges profil** (`company` — kizárólag a fiók tulajdonosa / Owner látja és szerkesztheti): Cégnév, Megjelenített képviseleti név, Iroda/Székhely címe, Központi telefonszám, Központi e-mail cím, Irodai ügyfélfogadás, valamint a lakói eszkalációs csatorna kapcsolója.
     3. 🔒 **Fiók & Biztonság** (`security`): Jelszóváltás, bejelentkezve maradás.
     4. ⚙️ **Alkalmazás-beállítások** (`preferences`): Értesítési hangok, rendszerüzenetek, felület nyelve (HU/EN).
   - **Csapat & Jogosultságok (`TeamManagementModal.jsx`)**: 100%-ban letisztult a munkatársak, meghívások, házkiosztások és biztonsági jogosultsági szintek kezelésére; a korábbi céges profil szerkesztése teljesen kikerült innen a Rendszerbeállítások Céges profil fülére.

2. **Kollégák / Alkalmazottak Saját Házkezelői Profilja (`isStaff`)**:
   - A meghívott kollégák (`isStaff: true`) a fejléc profil menüjében nem látják és nem szerkeszthetik a központi céges adatokat (cégnév, székhely cím nem írható felül általuk).
   - Ehelyett a profil ablak számukra kifejezetten a **"Saját Házkezelői Elérhetőségek"** (`staff_profile_title`) nézetet jeleníti meg:
     - Fejlécben egy diszkrét jelvény jelzi a központi képviseleti cég nevét.
     - Csak a közvetlen munkatársi kapcsolattartó mezők szerkeszthetők: *Házkezelő neve*, *Közvetlen telefonszáma*, *Közvetlen e-mail címe*, *Ügyfélfogadási ideje*.

3. **Házankénti Jogosultságok és Lakói Kapcsolattartó Kiosztás (`buildingAssignments`)**:
   - **Kizárólagosság a Csapat & Jogosultságok menüpontban**:
     - A lakóknak megjelenő felelős házkezelő és a központi céges eszkalációs elérhetőség kapcsolója kizárólag a **Csapat & Jogosultságok** (`TeamManagementModal.jsx`) felületen, a munkatársak házakhoz rendelésekor állítható be.
     - A korábbi kettős beállítási lehetőségek megszűntek: a `GlobalBalancesModal.jsx` felületéről a kézi váltógombok törlésre kerültek (helyükre informatív státuszjelvény került), és a `ProfileModal.jsx` cégprofiljából is eltávolításra került a felesleges kapcsoló.
   - **Ugyanazon e-mail címhez különböző házakon eltérő jogosultságok**:
     - Egy munkatárs (`member.buildingAssignments[buildingId]`) minden egyes hozzárendelt társasházán egyedileg konfigurálható:
       - 👤 **„Az ő adatai jelenjenek meg a lakóknak mint képviselő / kezelő”** (`showManagerContact`): bepipálva a lakók a munkatárs nevét, telefonját és e-mailjét látják; ha nincs bepipálva, a tulajdonos / központi cég adatai látszanak.
       - 🏢 **„Központi cégadatok megjelenítése a lakóknak (eszkaláció)”** (`showCentralContact`): szabályozza, hogy a cég központi ügyfélszolgálata megjelenjen-e másodlagos minőségbiztosítási pontként a lakóknak.
       - 🔒 **„Bankszámlaszám (IBAN) módosítása ezen a házon”** (`canEditBankAccounts`): házankénti felülbírálat a folyószámla és megtakarítási számlaszámok védelmére.
       - 📋 **„Jogosultság ezen a házon”** (`role`): `manager` (Teljes kezelő: rögzítés, könyvelés, módosítás) vagy `viewer` (Csak megtekintő: olvasási jog).
     - **Egységes, nagy kártyás megjelenítés (`Jogosultságok és lakói megjelenítés`)**: A korábbi apró, görgetősávba ágyazott almenük helyett minden beállítás egységes stílusú, tágas, jól olvasható fehér kártyaként jelenik meg azonos térközzel, Lucide ikonokkal és részletes súgószöveggel.
     - **Több házas hatókör-választó**: Ha több ház van kijelölve, a jogosultságok fejlécében található hatókör-választóval (`selectedBuildingConfigTab`) egyetlen kattintással egyszerre lehet az összes kijelölt házra módosítani a beállításokat, vagy kiválasztva egy konkrét házat egyedi jogosultság adható meg neki, és az *„Alkalmazás az összes kijelölt házra”* gombbal bármikor átmásolható a többi házra is.
     - **Prominens Szerepkör választó**: A *Teljes kezelő* (`manager`) és *Csak megtekintő* (`viewer`) két különálló, nagy méretű kártyagombbal választható ki a jogosultságlista legelején.

4. **Lakói Felület Megjelenítés (`TenantView.jsx`)**:
   - Ha egy épület kapcsolattartási módja **Házkezelő** (`contactDisplayMode === 'manager'`), az elsődleges kiemelt kártyán a kijelölt házkezelő közvetlen neve, telefonja, e-mailje és fogadóórája jelenik meg.
   - Amennyiben a házhoz be van kapcsolva a központi cégadatok megjelenítése (`showCentralContactToResidents: true`), a házkezelő kártyája alatt megjelenik a diszkrét másodlagos sáv: **"Központi Iroda / Ügyfélszolgálat (Eszkaláció)"** a központi telefonszámmal és e-mail címmel.
   - Ha nincs bepipálva a munkatárs megjelenítése, a lakók változatlanul a központi céges vagy tulajdonosi elérhetőséget látják.

5. **Kétnyelvűség és Tesztlefedettség**:
   - Teljes szimmetrikus magyar és angol fordításkulcsok a `src/constants/translations.js` fájlban (`team_assign_*`, `bld_contact_team_managed_hint`).
   - 9 egységtesztből álló tesztcsomag a `tests/teamPermissions.test.mjs` fájlban (beleértve a 9. tesztesetet a házankénti eltérő jogosultságok, `canUserManageBuilding`, `canUserEditBankAccountNumbers` és `resolveBuildingResidentContact` ellenőrzésére).

---

## 27. Automatikus Értesítési Szabályok – Pontos Időpont Beállítás (dispatchTime) és Resend Domain Integráció

1. **Egyedi és Pontos Időpont Beállítás (`dispatchTime`)**:
   - A korábbi kizárólagos reggel 8:00-i kiküldés helyett mostantól minden felszólítási szabályhoz (`emailRule`) egyedileg megadható a havi nap (`checkDayOfMonth`, 1-31) és a **pontos kiküldési időpont** (`dispatchTime`, pl. `"08:00"`, `"09:30"`, `"14:00"`) `HH:mm` formátumban.
   - **Alapértelmezés és Visszafelé Kompatibilitás**: Ha egy meglévő szabály nem tartalmaz `dispatchTime`-ot, a rendszer automatikusan `"08:00"`-nak tekinti (`parseDispatchTime(rule.dispatchTime)`).
   - **Kliensoldali és Szerveroldali Szinkron**:
     - `src/utils/dunningRules.js`: `shouldRuleAutoDispatchToday` percre pontosan ellenőrzi az aktuális Europe/Budapest időt (`currentTotalMinutes >= targetTotalMinutes`).
     - `functions/src/dunning.js`: A Cloud Functions ütemező 15 percenként fut (`schedule: 'every 15 minutes'`), így bármilyen napszakban beállított szabályok automatikusan lefutnak.
     - `src/context/AppContext.jsx`: A kliensoldali 60 másodperces ellenőrző ciklus azonnal elindítja a kiküldést, amint a böngésző nyitva van és a megadott perc elérkezik.
   - **Felhasználói Felület (`EditEmailRuleModal.jsx`, `CommunicationCenterModal.jsx`)**:
     - Szigorúan 24-órás időválasztó negyedórás lépésközzel (Óra: 00–23, Perc: 00, 15, 30, 45), pontosan illeszkedve a Cloud Scheduler 15 perces ütemezéséhez. A felirat letisztult: "Kiküldés pontos ideje".
     - A szabálykártyákon letisztult fejléc: a felesleges "aktív", "utolsó kiküldés" és csatorna jelvények helyén közvetlenül az ütemezés látható: `⏰ Minden hó {day}. – {time} (automatikusan)` és az épület chipje.
     - Kétnyelvű támogatás (`comm_rule_dispatch_time_label`, `comm_rule_dispatch_time_hint`, `comm_dispatch_now`) magyar és angol nyelven.

2. **Resend Hitelesített Domain Integráció (`mail.hazapp.hu`) & Serverless Cloud Functions**:
   - Feladó: `HazApp <ertesito@mail.hazapp.hu>`, DKIM/SPF/DMARC rekordokkal hitelesítve a Rackhost DNS-ben.
   - **CORS és Biztonsági Védelem**: A Resend API nem engedélyezi a közvetlen böngészőből történő hívást (CORS hiba / `Failed to fetch`). Ennek elhárítására egy Firebase Callable Cloud Function (`sendTransactionalEmail`, europe-west1) végzi a levelek szerveroldali kiküldését, titkosítva tárolt `RESEND_API_KEY` környezeti változóval.
   - A válaszcím (`Reply-To`) dinamikusan a társasház képviselőjének közvetlen e-mail címe, így a lakók válaszai nem vesznek el.
   - **Valódi Kiküldés Gomb**: A Kommunikációs Központban a szabályok azonnal elindíthatók a "Kiküldés most" gombbal (nem csak szimulációként), ami valós e-maileket küld ki és `sent` státusszal jegyzi be a kiküldési naplóba.
   - **Azonnali Optimista Levélküldési Felület**: A "+ Új levél írása" gomb megnyomásakor a felugró ablak azonnal bezáródik, és a felhasználó átvált az Outbox naplóra, miközben a küldés párhuzamosan a háttérben fut, kiküszöbölve a betöltési várakozást.
   - **Letisztult E-mail Sablon**: Az e-mail tetején lévő kék fejléc kizárólag a hivatalos "Hivatalos Közös Képviseleti Tájékoztató" feliratot tartalmazza, elkerülve a felesleges épületnév- és megszólítás-duplikációt. A levél láblécéből szintén kikerült a felesleges épületnév és cím is, így kizárólag a közvetlen válaszadási e-mail link szerepel benne.
   - **Kézbesítés és Feladó Cím Frissítés (`kozoskepviselet@mail.hazapp.hu`)**: A korábbi `ertesito@mail.hazapp.hu` helyett `kozoskepviselet@mail.hazapp.hu` címet és `Közös Képviselet` megjelenített nevet állítottunk be feladóként mind a Cloud Functions-ben (`functions/src/dunning.js`), mind a kliensoldali `emailService.js`-ben, megelőzve, hogy a Gmail automatikus gépértesítőként a "Frissítések" fülre tegye a leveleket.
   - **Adminisztrátori Felület Letisztítás**: Az elmaradások (Arrears) KPI kártyáján lévő "+ Új tétel rögzítése" gomb mellől eltávolításra került a redundáns "Naptár" gomb, a rögzítés gomb pedig teljes szélességű lett (`src/views/AdminView.jsx`).


---

## 28. Maintenance Checklist for Future Sessions

Mielőtt bármilyen feladatot befejeznél:
1. **Szabály 1 (Kétnyelvűség)**: Lefordítottál minden új felhasználói szöveget, címkét és üzenetet angolra is a `translations.js` fájlban (`hu` és `en` szinkronban)?
2. **Szabály 2 (Dokumentáció)**: Frissítetted a releváns `/docs/*.md`, `AGENT.md` vagy `GEMINI.md` fájlokat, hogy a változások pontosan dokumentálva legyenek a következő fejlesztési lépéshez?
3. **Szabály 3 (Adatbázis-védelem)**: Kizárólag a felhasználó kifejezett jóváhagyásával nyúltál hozzá éles adathoz? (Semmilyen automatizált teszt vagy script nem módosított éles RTDB adatot!)
4. **Szabály 4 (Adatbiztonság)**: Megvizsgáltad a biztonsági vonzatokat, és tettél proaktív javaslatot az esetleges gyenge pontok megerősítésére?
5. **Build ellenőrzés**: Lefuttattad az `npm run build` parancsot, és 0 hiba/figyelmeztetés keletkezett?
6. **Legacy védelem**: Érintetlenül hagytad a `new-project/` mappát?
