# Tarsashazkezelo – Adatbazis-schema dokumentacio

> **Hataskor:** Firebase Realtime Database (RTDB) + Firestore (fallback) + localStorage cache + Permanent Vault
> **Adatmodell tipusa:** Schema nelkuli JSON-fa (NoSQL); egyetlen ``condo_state`` dokumentum / RTDB csomopontban tarolva

---

## 1. Globalis State struktura

Az alkalmazas egyetlen ``let state = { ... }`` objektumban tarolja a teljes futasideju allapotot.
Az objektum ket reszebol all:

- **UI-vezerlesi mezok** – navigaciohoz, nyelvhez, aktiv epulethez
- **Shortcut-pointerek** – az aktiv epulet adatainak gyors elereset segito referenciak

### 1.1 Gyoker szintu mezok

| Mezo | Tipus | Leiras |
|---|---|---|
| ``currentLang`` | ``"hu" \| "en"`` | Aktiv feluelti nyelv. Alapertelmezett: ``"hu"`` |
| ``currentUser`` | ``User \| null`` | A bejelentkezett felhasznalo objektuma. ``null`` = kijelentkezve |
| ``currentBuildingId`` | ``string`` | Az aktiv epulet azonositoja (pl. ``"batyu21"``). Szures alapja |
| ``currentFlatDetailNum`` | ``string \| null`` | Nyitott lakasmodal lakasszama (UI-allapot, nem perzisztens) |
| ``isGridEditMode`` | ``boolean`` | Admin racs szerkesztesi modja. Reset-elodik betoltestekor |
| ``buildings`` | ``Building[]`` | Osszes epulet teljes adatfaja (lasd 1.2) |
| ``users`` | ``User[]`` | Osszes felhasznalo (lakas + admin). Jelszavakat is tartalmaz |
| ``revision`` | ``number`` | Monoton novekvo verzioszam. Minden mentesnel +1. Konfliktusfeloldashoz |
| ``lastUpdated`` | ``number`` | Unix timestamp (ms). Az utolso modositas ideje |

**Aktiv epulet shortcut-pointerek** (``getCurrentBuilding()`` szinkronizalja oket):

| Mezo | Tipus | Leiras |
|---|---|---|
| ``flats`` | ``Flat[]`` | Aktiv epulet lakasainak tombje |
| ``transactions`` | ``Transaction[]`` | Aktiv epulet befizeteseinek tombje |
| ``expenses`` | ``Expense[]`` | Aktiv epulet kiadasainak tombje |
| ``manualDebits`` | ``ManualDebit[]`` | Aktiv epulet manualis terheleseinek tombje |
| ``documents`` | ``Document[]`` | Aktiv epulet dokumentumainak tombje |
| ``buildingInitialReserveCommon`` | ``number`` | KK szamla indulo egyenlege (Ft) |
| ``buildingInitialReserveRenovation`` | ``number`` | FA szamla indulo egyenlege (Ft) |

---

### 1.2 Building objektum

```json
{
  "id": "batyu21",
  "name": "Batyu utca 21. Tarsashaz",
  "address": "Batyu utca 21.",
  "bankKK": {
    "name": "Batyu utca 21 Tarsashaz",
    "account": "11702005 21461266",
    "bank": "OTP"
  },
  "bankFA": {
    "name": "Batyu utca 21 Tarsashaz",
    "account": "11702005 21461273",
    "bank": "OTP"
  },
  "buildingInitialReserveCommon": 1640634,
  "buildingInitialReserveRenovation": 1124695,
  "flats": [ ... ],
  "transactions": [ ... ],
  "expenses": [ ... ],
  "manualDebits": [ ... ],
  "documents": [ ... ]
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito (pl. ``"batyu21"``, uj epuletnel ``"b-<timestamp>"``) |
| ``name`` | ``string`` | Tarsashaz neve (fejlecben jelenik meg) |
| ``address`` | ``string`` | Cim |
| ``bankKK`` | ``BankInfo`` | Kozos Koltseg bankszamla adatai (``name``, ``account``, ``bank``) |
| ``bankFA`` | ``BankInfo`` | Felujitasi Alap bankszamla adatai |
| ``buildingInitialReserveCommon`` | ``number`` | KK egyenleg-korrekcios offset (Ft) |
| ``buildingInitialReserveRenovation`` | ``number`` | FA egyenleg-korrekcios offset (Ft) |
| ``flats`` | ``Flat[]`` | Lakasok tombje |
| ``transactions`` | ``Transaction[]`` | Befizetes-rekordok tombje |
| ``expenses`` | ``Expense[]`` | Kiadas-rekordok tombje |
| ``manualDebits`` | ``ManualDebit[]`` | Manualis terheles-rekordok tombje |
| ``documents`` | ``Document[]`` | Dokumentumok tombje |

---

### 1.3 Flat objektum

```json
{
  "flatNum": "Fsz 2",
  "ownerName": "Baltay Benedek",
  "email": "benedek.baltay@gmail.com",
  "monthlyFee": 20630,
  "renovationFee": 4214,
  "balance": 0,
  "renovationBalance": 0,
  "ownershipShare": 8.78,
  "tenantCount": 2,
  "feeChangesKK": [ { "date": "2025-01", "amount": 21000 } ],
  "feeChangesFA": [ { "date": "2025-01", "amount": 4500 } ],
  "cancelledDebits": [ "2025-01_Kozos Koltseg" ],
  "initialBalance": 0,
  "initialRenovationBalance": 0,
  "phone": "+36 30 123 4567"
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``flatNum`` | ``string`` | Lakasszam (egyedi azonosito az epuleten belul, pl. ``"Fsz 2"``, ``"I 4"``) |
| ``ownerName`` | ``string`` | Tulajdonos neve |
| ``email`` | ``string`` | Belep-esi e-mail cim |
| ``phone`` | ``string?`` | Telefonszam (opcionalis) |
| ``monthlyFee`` | ``number`` | Havi KK eloir-as (Ft) – aktualis alap ertek |
| ``renovationFee`` | ``number`` | Havi FA eloir-as (Ft) |
| ``balance`` | ``number`` | KK egyenleg (szamitott, runtime-ban frissul) |
| ``renovationBalance`` | ``number`` | FA egyenleg (szamitott, runtime-ban frissul) |
| ``ownershipShare`` | ``number`` | Tulajdoni hanyadszazalek (pl. ``8.78``) |
| ``tenantCount`` | ``number`` | Lakos/berlok szama |
| ``feeChangesKK`` | ``FeeChange[]?`` | KK dijvaltozasok tortenetei: ``{ date: "YYYY-MM", amount: number }`` |
| ``feeChangesFA`` | ``FeeChange[]?`` | FA dijvaltozasok tortenetei |
| ``cancelledDebits`` | ``string[]?`` | Torolt havi eloirasok kulcsai: ``"YYYY-MM_szamla"`` formatum |
| ``initialBalance`` | ``number?`` | KK-nyito egyenleg (migraciohoz) |
| ``initialRenovationBalance`` | ``number?`` | FA-nyito egyenleg (migraciohoz) |

---

### 1.4 Transaction objektum (befizetes)

```json
{
  "id": "t-1722000000000",
  "flatNum": "Fsz 2",
  "date": "2025-06-15",
  "amount": 20630,
  "method": "Bank Transfer",
  "status": "Verified",
  "targetAccount": "Kozos Koltseg",
  "comment": "Juniusi befizetes",
  "includeInBalance": true
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito: ``"t-<timestamp>"``; Global-epulet tetelek is ide keriulnek |
| ``flatNum`` | ``string`` | Lakas azonositoja, vagy ``"Global"`` ha epulet-szintu bevetel |
| ``date`` | ``string`` | ISO datum (``"YYYY-MM-DD"``) |
| ``amount`` | ``number`` | Osszeg Ft-ban (pozitiv = befizetes/hozam) |
| ``method`` | ``string`` | Befiz. modja: ``"Bank Transfer"`` \| ``"Cash Offset"`` |
| ``status`` | ``"Verified"`` | Mindig ``"Verified"`` – jovahagyatlan statusz jelenleg nincs hasznalatban |
| ``targetAccount`` | ``string`` | Cel-szamla: ``"Kozos Koltseg"`` \| ``"Felujitasi Alap"`` |
| ``comment`` | ``string?`` | Szabad szoveges megjegyzes |
| ``includeInBalance`` | ``boolean`` | Ha ``false``, az epulet egyenlegebe nem szamit bele |
| ``type`` | ``"Correction"?`` | Egyszeri korrekcios tetel jelolese (kizar-ja a havi statisztikabol) |

---

### 1.5 Expense objektum (kiadas)

```json
{
  "id": "e-1722000000001",
  "date": "2025-06-20",
  "category": "Utility",
  "provider": "E.ON Aram Kft.",
  "targetAccount": "Kozos Koltseg",
  "amount": 85000,
  "comment": "Juniusi aramszamla",
  "includeInBalance": true
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito: ``"e-<timestamp>"`` |
| ``date`` | ``string`` | ISO datum (``"YYYY-MM-DD"``) |
| ``category`` | ``string`` | Kategoria: ``"Utility"`` \| ``"Insurance"`` \| ``"Maintenance"`` \| ``"Bank Fee"`` \| ``"Other"`` |
| ``provider`` | ``string`` | Szolgaltato neve (megjelenites) |
| ``targetAccount`` | ``string`` | Terhelt szamla: ``"Kozos Koltseg"`` \| ``"Felujitasi Alap"`` |
| ``amount`` | ``number`` | Osszeg Ft-ban (pozitiv szam, kiadaskent vonodik le) |
| ``comment`` | ``string?`` | Megjegyzes |
| ``includeInBalance`` | ``boolean`` | Ha ``false``, nem szerepel az epulet egyenlegszamitasaban |

---

### 1.6 ManualDebit objektum (manualis terheles)

```json
{
  "id": "d-manual-1722000000002",
  "flatNum": "I 4",
  "date": "2025-07-01",
  "amount": 5000,
  "targetAccount": "Kozos Koltseg",
  "category": "Other",
  "comment": "Kulonleges dij",
  "includeInBalance": true
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito: ``"d-manual-<timestamp>"`` |
| ``flatNum`` | ``string`` | Az erintett lakas azonositoja |
| ``date`` | ``string`` | ISO datum |
| ``amount`` | ``number`` | Osszeg Ft-ban |
| ``targetAccount`` | ``string`` | Cel-szamla |
| ``category`` | ``string`` | Terheles kategorija |
| ``comment`` | ``string?`` | Megjegyzes |
| ``includeInBalance`` | ``boolean`` | Beleszamit-e az egyenlegbe |

> **Megjegyzes:** A ``ManualDebit`` kizarolag a **lakas egyenleget** csokkenti. Az epulet kozos keszletet (building reserve) NEM terheli – ellenteben az ``Expense`` tipussal.

---

### 1.7 Document objektum

```json
{
  "id": "doc-1722000000003",
  "title": "Szervezeti es Mukodesi Szabalyzat",
  "fileName": "SZMSZ_Batyu21.pdf",
  "fileSize": "1.8 MB",
  "fileType": "pdf",
  "uploadDate": "2024-02-15",
  "fileData": "data:application/pdf;base64,..."
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito: ``"doc-<timestamp>"`` |
| ``title`` | ``string`` | Dokumentum neve (kereshetoo) |
| ``fileName`` | ``string`` | Fajlnev |
| ``fileSize`` | ``string`` | Merethuman-readable formaban (pl. ``"1.8 MB"``) |
| ``fileType`` | ``string`` | Kiterjesztes kis betuvel (pl. ``"pdf"``, ``"xlsx"``) |
| ``uploadDate`` | ``string`` | ISO datum (``"YYYY-MM-DD"``) |
| ``fileData`` | ``string \| null`` | Base64 kodolt fajltartalom (``"data:<mime>;base64,..."``) vagy ``null`` ha nincs fajl csatolva |

---

### 1.8 User objektum

```json
{
  "id": "Fsz 2",
  "name": "Baltay Benedek",
  "email": "benedek.baltay@gmail.com",
  "pass": "lakas123",
  "role": "Owner",
  "flatNum": "Fsz 2",
  "buildingId": "batyu21"
}
```

| Mezo | Tipus | Leiras |
|---|---|---|
| ``id`` | ``string`` | Egyedi azonosito (lakasnalsz am vagy ``"admin"``, uj felhasznalonal ``"u-<timestamp>"``) |
| ``name`` | ``string`` | Megjelenesi nev |
| ``email`` | ``string`` | Bejelentkezesi email |
| ``pass`` | ``string`` | Jelszoo (plaintextben tarolva; nincs hasheles) |
| ``role`` | ``"admin" \| "Owner"`` | Szerepkor |
| ``flatNum`` | ``string`` | Hozzarendelt lakas (Owner-nel) vagy ``"0"`` (admin-nel) |
| ``buildingId`` | ``string?`` | Az epulet azonositoja, amelyhez a felhasznalo tartozik |

---

## 2. Firebase Adatbazis Schema

### 2.1 RTDB (Realtime Database) fa-struktura

Az egeszalkalmazas-allapat **egyetlen RTDB-csomopontba** van menve:

```
condo_state/
  buildings/           # Building[] tomb (JSON array)
    0/
      id               # "batyu21"
      name
      address
      bankKK/
      bankFA/
      buildingInitialReserveCommon
      buildingInitialReserveRenovation
      flats/           # Flat[] tomb
        0/ ... N/
      transactions/    # Transaction[] tomb
        0/ ... N/
      expenses/        # Expense[] tomb
        0/ ... N/
      manualDebits/    # ManualDebit[] tomb
        0/ ... N/
      documents/       # Document[] tomb (fileData-val)
        0/ ... N/
    1/ ... N/
  users/               # User[] tomb
    0/ ... N/
  vault/               # Permanent Vault metaadat
    deletedIds/        # Torolt tranzakcio-ID-k (string[])
    deletedFlatNums/   # Torolt lakasszamok (string[])
    flatOverrides/     # { flatNum: { ...override } }
    buildingInitialReserveCommon/   # { buildingId: number }
    buildingInitialReserveRenovation/ # { buildingId: number }
    lastUpdated        # number (unix ms)
  revision             # number (monoton novekvo)
  lastUpdated          # string (ISO timestamp)
```

### 2.2 Firestore (fallback) schema

> [!WARNING]
> **Figyelem: A Firestore le van tiltva!**
> Mivel a Firebase projektben a Cloud Firestore API nincs engedélyezve (letiltott állapotban van), a Firestore-ra irányuló kérések hálózati tiltási hibát és végtelen újrapróbálkozási hurkokat okoztak. A zökkenőmentes és gyors működés érdekében a Firestore modul inicializálása és írása az `app.js` kódban le lett tiltva. A rendszer kizárólag a **Realtime Database (RTDB)** adatbázist használja felhős szinkronizációra.

```
condo_app/ (collection)
  main_state (document)
    buildings: [...]     # azonos a RTDB-vel
    users: [...]
    vault: { ... }
    revision: number
    lastUpdated: string
```

A Firestore ``merge: true`` flag-gel ment volna, de ez a csatorna jelenleg teljesen inaktív.

### 2.3 localStorage sema

| Kulcs | Tartalom |
|---|---|
| ``tarsashaz_state`` | Teljes ``state`` objektum JSON-ba sorositve (villamgyors inditashoz) |
| ``tarsashaz_permanent_vault`` | Permanent Vault (kizarolag ``deletedIds`` es ``deletedFlatNums`` torlesi tombstone-ok) |
| ``tarsashaz_state_backup`` | Automata biztonsagi masol-at (ha a fomentesbe belefer) |

---

## 3. Revizio es Perzisztencia mezok

### 3.1 Verziokovetes mezoink

| Mezo | Hol talalhato | Tipus | Funkcioja |
|---|---|---|---|
| ``state.revision`` | state gyoker | ``number`` | Minden ``saveStateToLocalStorage()`` hivasakor +1. A felho es a lokalis allapat osszevetesere hasznalt. |
| ``state.lastUpdated`` | state gyoker | ``number`` | Unix ms timestamp. Az utolso menteskor ``Date.now()`` ertekre all. |
| ``building.lastUpdated`` | building | ``number`` | Az epulet-specifikus utolso modositas ideje |
| ``vault.lastUpdated`` | Permanent Vault | ``number`` | A vault utolso irasakor frissul |
| ``payload.lastUpdated`` | Firebase payload | ``string`` | ISO timestamp string (``new Date().toISOString()``) a felho-szinkron pillanataban |

### 3.2 Mentesi sorrend es feltetelei

```
Felhasznaloi akcio
       |
       v
saveStateToLocalStorage()
  |-- state.revision += 1
  |-- state.lastUpdated = Date.now()
  |-- building.lastUpdated = Date.now()
  |-- Permanent Vault frissitese (deletedIds, deletedFlatNums tombstones)
  |-- localStorage.setItem("tarsashaz_state", ...)
  |-- syncStateToCloud() [250ms debounce]
         |-- RTDB.ref("condo_state").set(payload)
```

### 3.3 Konfliktusfeloldas (Optimistic Concurrency)

A ``applyCloudStateUpdate()`` fuggveny:
1. Egyesiti a helyi es a felho tranzakciokat / kiadasokat (unio azonosito szerint).
2. Alkalmazza a felho valos epuleti indulo tartalekait (`buildingInitialReserveCommon`, `buildingInitialReserveRenovation`).
3. Kiszuri a torolt elemeket a Permanent Vault (`deletedIds`, `deletedFlatNums`) alapjan.
4. Ujraszamolja a lakasok egyenlegeit es a tarsashaz tartalekait.
5. Csak akkor kuld szinkront a felhobe, ha a helyi revizio szigoruan nagyobb (`localRevision > cloudRevision`).

A **Permanent Vault** ``deletedIds`` es ``deletedFlatNums`` tombje biztositja, hogy torlest kovetoen egy regi felho-snapshot NE tudja visszahozni a torolt elemeket.

---

## 4. Szerepkorok es Jogosultsagok (Adatszinten)

### 4.1 Olvasasi jogok

| Adattipus / Mezo | Owner (lako) | Admin (kepviselo) |
|---|---|---|
| Sajat lakas adatai (``flatNum``, ``ownerName``, ``email``, ``phone``) | Igen (csak sajat) | Igen (minden lakas) |
| Sajat lakas egyenlegei (``balance``, ``renovationBalance``) | Igen (csak sajat) | Igen (minden lakas) |
| Havi KK/FA eloir-as | Igen (csak sajat) | Igen (minden lakas) |
| Sajat tranzakciok (``transactions`` flatNum alapjan szurve) | Igen (csak sajat) | Igen (minden) |
| Epulet KPI-k (kozos keszlet, FA alap) | Igen (atlathato-sagi nez-etben) | Igen |
| Mas lakas egyenlegei | Nem | Igen |
| Mas lakas tranzakcioi | Nem | Igen |
| ``users`` tomb (jelszavakkal) | Nem | Igen |
| Dokumentumok | Igen (lista + letoltes) | Igen + torles + feltoltes |
| Epulet bankszamla adatai | Igen (utalasi utmutato) | Igen |

### 4.2 Irasi/modositasi jogok

| Muvelet | Owner | Admin |
|---|---|---|
| Sajat jelszoo megvaltoztatas | Igen | Igen |
| Uj befizetes rogzitese (transaction) | Nem | Igen |
| Kiadas rogzitese (expense) | Nem | Igen |
| Manualis terheles (manualDebit) | Nem | Igen |
| Lakas adatainak modositasa | Nem | Igen |
| KK/FA eloir-as megvaltoztatas (feeChanges) | Nem | Igen |
| Uj lakas hozzaadasa | Nem | Igen |
| Lakas torlese | Nem | Igen |
| Tranzakcio / kiadas szerkesztese | Nem | Igen |
| Tranzakcio / kiadas torlese | Nem | Igen |
| Epulet egyenleg korrekcio (buildingInitialReserve) | Nem | Igen |
| Dokumentum feltoltese | Nem | Igen |
| Dokumentum torlese | Nem | Igen |
| Uj epulet letrehozasa | Nem | Igen |
| Felhasznalo jelszoo resetelese | Nem | Igen |

### 4.3 Adatszinti elkulonites megvalositasa

Az alkalmazas kliens-oldali rollenorizest hasznal. A Firebase-ben **nincsenek server-oldali biztonsagi szabalyok** (Security Rules) beallitva – a hozzaferes-ellenorzes kizarolag a JavaScript ``state.currentUser.role`` feltetelon alapul.

```js
// Peldak a szerepkorellen-orzesre az app.js-ben:

// Admin-only UI elem:
if (state.currentUser.role.toLowerCase() === "admin") {
    // admin-view megjelenites
}

// Lakas-adatok szu-rese Owner-nek:
const flat = state.flats.find(f => f.flatNum === state.currentUser.flatNum);
// Csak sajat lakasra szurkezi az adatokat

// Admin mezo-lathatosag (pl. jelszoo-reset gomb):
// Csak admin-view-ban renderelt gomb
```

> **Biztonsagi megjegyzes:** A jelszavak plaintext formaban vannak tarolva a ``state.users`` tombben, lokalis storageba-n es a Firebase adatbazisban. Nincs Firebase Auth integracioo, nincsenek RTDB/Firestore Security Rules-ok. Ezert a jelenlegi architektura kizarolag bizalmi halozatban (pl. csaladon belul, zartkoru tarsashaz) ajanlott elerni.