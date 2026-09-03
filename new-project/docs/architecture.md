# Tarsashazkezelo - Architektura dokumentacio

> **Alkalmazas neve:** Kozos Koltseg Nyilvantarto
> **Tipus:** Egyoldalas webalkalmazas (SPA), keretrendszer nelkuli Vanilla JS
> **Celkozonseg:** Tarsashazi lakok (Owner) es a kozos kepviselo (Admin)

---

## 1. Hasznalt technologiak

| Reteg | Technologia | Verzio / Forras |
|---|---|---|
| **Markup** | HTML5 | `index.html` (1958 sor) |
| **Stilus** | Vanilla CSS (custom design system) | `styles.css` - CSS valtozok + Grid/Flex |
| **Logika** | Vanilla JavaScript (ES6+) | `app.js` (5246 sor) |
| **Ikonok** | Lucide Icons | CDN (legujabb) |
| **Betutipusok** | Google Fonts - Inter + Outfit | CDN |
| **Felhos adatbazis** | Firebase Realtime Database + Firestore | v10.8.0 (compat mod) |
| **Tarhely** | Firebase Hosting | `tarsashaz-cfe5d` project |
| **Alternativ deploy** | Vercel | `.vercel/` konfig |
| **Excel export** | SheetJS (xlsx) | v0.18.5 |
| **Lokalis szerver** | Node.js (`server.js`) | - |

---

## 2. Fo fajlok es konyvtarak

### Belepesi pontok

| Fajl | Funkciok |
|---|---|
| `index.html` | Teljes alkalmazas HTML-je: fejlec, nezetek (login/tenant/admin), osszes modal, Firebase SDK + app.js betoltese |
| `app.js` | Minden alkalmazaslogika: allapotkezeles, routing, rendereles, Firebase-szinkron, i18n |
| `styles.css` | Globalis stilusok, CSS-valtozok (color tokens, spacing, shadows), komponensek |
| `firebase.json` | Firebase Hosting config - minden URL-t index.html-re iranyit (SPA-rewrite) |
| `server.js` | Egyszeru Node.js fejlesztoi szerver helyi futtatashoz |

### Segedscriptek (gyokerben)

A gyokerkonyvtarban nagyszamu `fix_*.js`, `add_*.js`, `apply_*.js`, `test_*.js` fajl talalhato.
**Ezek nem reszei a futo alkalmazasnak** - egyszeri adatmigraclos, javito, illetve tesztelo segedskriptek, amelyek `node <fajlnev>` paranccsal futtathatoak.

---

## 3. Routing struktura

Az alkalmazas **URL-alapu router nelkul** mukodik. A "navigacio" DOM-lathatosag kapcsolgatasaval valosul meg: az aktiv nezet `display: flex`, a tobbi `display: none`.

### Fo nezetek (`<section class="view-section">`)

Az index.html-ben harom fo nezet van:

- `#login-view` - Bejelentkezesi kepernyő (alapertelmezett)
- `#tenant-view` - Lakoi nezet (Owner szerepkor)
- `#admin-view` - Adminisztratoros nezet (Admin szerepkor)

### Nezetek kozotti valtas (updateAppView)

- `state.currentUser === null` -> `#login-view` jelenik meg
- `currentUser.role === "admin"` -> `#admin-view` + `renderAdminDashboard()`
- `currentUser.role === "Owner"` -> `#tenant-view` + `renderTenantDashboard()`

### Hamburger-menu navigacio (handleMenuOption)

- `goToMainMenu()` -> fonezetre valt (admin/tenant)
- `'docs'` -> Dokumentumok szekciora lep
- `'loans'` -> Hitelek szekciora lep (fejlesztes alatt)
- `'logout'` -> kijelentkezes -> `#login-view`

### Modalok (overlay reteg)

| Modal ID | Funkciok |
|---|---|
| `#flat-detail-modal` | Lakas reszletes adatlapja |
| `#transaction-modal` | Uj tranzakcio / kiadas rogzitese |
| `#edit-transaction-modal` | Meglevo tetel szerkesztese |
| `#fullscreen-tx-modal` | Teljes tranzakcio-lista fullscreen nezetben |
| `#building-selector-modal` | Epuletvaltas |
| `#add-flat-modal` | Uj lakas hozzaadasa |
| `#global-balances-modal` | Szamlafooosszegek beallitasa |
| `#forgot-password-modal` | Elfelejtett jelszo |
| `#change-password-modal` | Jelszovaltoztatas |
| `#help-modal` | Sugo es kapcsolat |

---

## 4. Globalis allapotkezeles

### Az allapotobjektum (state)

Az alkalmazas egyetlen globalis JavaScript-objektumban tarolja a futasideju allapotot:

```js
state = {
  currentLang: 'hu',             // aktiv nyelv ('hu' | 'en')
  currentUser: null,              // bejelentkezett felhasznalo objektuma
  currentBuildingId: "batyu21",   // aktiv epulet azonositoja
  buildings: [ ... ],            // osszes epulet adata (lakasok, tranzakciok, kiadasok, dok.)
  users: [ ... ],                // felhasznalok + jelszavak
  flats: [],                     // aktiv epulet lakasainak shortcut-ja
  transactions: [],              // aktiv epulet befizeteseinek shortcut-ja
  expenses: [],                  // aktiv epulet kiadasainak shortcut-ja
  manualDebits: [],              // aktiv epulet manualis terhelesinek shortcut-ja
  buildingInitialReserveCommon: 0,      // KK indulo egyenleg
  buildingInitialReserveRenovation: 0,  // FA indulo egyenleg
  revision: 0,                   // verzioszamlalo a konfliktusfeloldashoz
  lastUpdated: 0                 // timestamp az utolso modositashoz
}
```

### Adatfolyam

```
Felhasznaloi akcio
       |
       v
state objektum modositas
       |
  +----+----------------------------+
  |                                 |
  v                                 v
saveStateToLocalStorage()        updateAppView() / renderXxx()
  |                                 |
  v                                 v
localStorage["tarsashaz_state"]  DOM frissites
  |
  v
syncStateToCloud() (250ms debounce)
  |
  +-- Firebase RTDB (Aktív felhős adatbázis)
  |   [Megjegyzés: A Firestore letiltásra került, mert az API-ja nincs engedélyezve a Firebase projektben.]
```

### Perzisztencia-retegek (prioritasi sorrendben)

| Reteg | Kulcs | Tartalom |
|---|---|---|
| **Firebase RTDB** | `condo_state` | Teljes state (epuletek, lakasok, tranzakciok, kiadasok, felhasznalok) - Elsodleges felhos adatforras |
| **Firebase Firestore** | `condo_app/main_state` | *Inaktív / Letiltva* (API hiányában a kódban letiltva a felesleges hibaüzenetek elkerülése végett) |
| **localStorage** | `tarsashaz_state` | Lokalis cache a villamgyors elso rendereleshez (offline mukodeshez) |
| **Permanent Vault** | `tarsashaz_permanent_vault` | Torlesi tombstone-ok (`deletedIds`, `deletedFlatNums`) |

### Konfliktusfeloldas es Szinkronizacio

1. **Azonnali rendereles helyi gyorsitarbol:** Oldalnyitaskor a `loadStateFromLocalStorage()` azonnal kirajzolja a helyi adatokat, igy a felulet villamgyorsan megjelenik.
2. **Valos ideju felho-hidratalas:** A Firebase RTDB figyelője (`on("value")`) megerkezesekor a kliens egyesiti a felho tranzakcioit es alkalmazza a valos epuleti indulo tartalekokat.
3. **Determinisztikus fuzio (`mergeStateWithCloud`):** A felho adatbazis epulettartalekai (`buildingInitialReserveCommon`, `buildingInitialReserveRenovation`) mindig a felho alapjan frissulnek, a tranzakciok unioja alapjan a teljes banki elozmeny megmarad.
4. **Permanent Vault tisztasag:** A Vault kizarolag a torlesi feketelistat kezeli (`deletedIds`, `deletedFlatNums`), nem tarol fagyasztott egyenleg-snapshotokat, igy a felho adatai nem torzulnak.
5. **Mobil / Lap-ébresztés szinkronizáció:** A `visibilitychange`, `focus` és `online` események automatikusan újraélesztik a Firebase RTDB kapcsolatot (`goOnline()`) és lekérik a legfrissebb felhő állapotot, ha a felhasználó feloldja a telefonját vagy visszavált a böngészőlapra.
6. **Beépített Alapállapot (Zero-Cold-Start Paritás):** A `DEFAULT_BUILDINGS` és `DEFAULT_USERS` (és benne a lakások nyitó egyenlegei, díjmódosításai, tranzakciói és költségei) 100%-ban megegyeznek a felhőbeli éles adatbázis állapotával. Ez garantálja, hogy inkognitó módban, új eszközön vagy lassú hálózati kapcsolat mellett is azonnal (0. ezredmásodpercben) a valós hátralékok és egyenlegek renderelődnek, kiküszöbölve a kezdeti 0 Ft-os vagy hibás állapotokat.

---

## 5. Lokalizacio (i18n)

- **Ket nyelv:** Magyar (`hu`) - alapertelmezett, Angol (`en`)
- **Szotar:** `const translations = { hu: {...}, en: {...} }` az `app.js` teten
- **Alkalmazas:** `applyTranslations()` - minden `[data-i18n]` es `[data-i18n-placeholder]` atributumot frissit
- **Valtas:** `toggleLanguage()` - allapotba menti, localStorage-ba irja, majd ujrarenderel; a nyitott modalok is automatikusan frissulnek

---

## 6. Szerepkorok es autentikacio

| Szerepkor | Hozzaferes |
|---|---|
| **Admin** | Teljes admin dashboard - KPI-k, lakasterkep, tranzakciok, szerkesztes, torles |
| **Owner** | Sajat lakas adatai, egyenlegek, utalasi adatok, tranzakciotortenet |

A bejelentkezes **e-mail + jelszo** parral, a `state.users` tomb alapjan tortenik (nem Firebase Auth).
Jelszavak a `tarsashaz_permanent_vault`-ban es a felhohon tarolodnak.

---

## 7. Deploymentek

| Platform | Konfig | |
|---|---|---|
| **Firebase Hosting** | `firebase.json` | https://tarsashaz-cfe5d.web.app |
| **Vercel** | `.vercel/` | alternativ deploy |