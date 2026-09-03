# Admin Management – Adminisztratoros nezet (admin-view)

## Cel

Az Admin (Kozos Kepviselo) szamara teljes iranyitasi feluletett biztosit: epulet penzugyi KPI-k, lakas-attekintesi racs (arrears matrix), tranzakcio-kezeles (rogzites / szerkesztes / torles), lakas- es lakoadatok modositasa, dijvaltozasok rogzitese, dokumentumfeltoltes (Base64), es epulet-szintu egyenleg-beallitas.

---

## Erintett DOM elemek / Modalok

### Fo nezet (#admin-view)

| Elem ID | Szerepe |
|---|---|
| ``#admin-view`` | Az admin fo szekcioja |
| ``#admin-kpi-balance`` | KK alap egyenlege (KPI kartya) |
| ``#admin-kpi-renovation`` | FA alap egyenlege (KPI kartya) |
| ``#admin-kpi-arrears`` | Osszes hatral ek osszege |
| ``#admin-kpi-stats`` | Aktualis havi marzsz (+/-) |
| ``#admin-kpi-sub-stats`` | Havi bevetel / kiadas bontasa |
| ``#arrears-matrix-list`` | Lakas tile-grid: minden lakashoz egy kartya |
| ``#admin-transactions-tbody`` | Osszes tranzakcio es kiadas listaja |
| ``#admin-search`` | Kereso input (datum, osszeg, nev, megjegyzes) |
| ``#admin-tx-edit-btn`` | Szerkesztesi mod be/ki kapcsolo gomb |
| ``#grid-edit-btn`` | Racs-szerkesztesi mod kapcsolo |
| ``#grid-add-flat-btn`` | Uj lakas hozzaadasa gomb (csak szerkesztesi modban latszik) |

### Modalok

| Modal ID | Szerepe |
|---|---|
| ``#flat-detail-modal`` | Lakás részletes adatlapja: felső azonosító sáv az egyenlegek előtt (Tulajdonos neve, E-mail cím, Lakók száma), egyenlegek (KK, FA) és havi előírások, valamint tranzakciós idővonal |
| ``#transaction-modal`` | Uj befizetes + kiad as rogzitese (ket urlap egy modalban) |
| ``#flat-detail-add-tx-modal`` | Lakas-specifikus vagy Global tetel rogzitese |
| ``#add-flat-modal`` | Uj lakas hozzaadasa az epulethez |
| ``#delete-confirm-modal`` | Lakas torleseno megerosito modal |
| ``#delete-tx-confirm-modal`` | Tranzakcio/kiadas torlesene megerosito modal |
| ``#global-balances-modal`` | Szamlafooosszegek beallitasa (KK + FA indulo egyenleg korrekcioja) |
| ``#edit-transaction-modal`` | Meglevo tranzakcio / kiadas szerkesztese |
| ``#documents-modal`` | Dokumentumok listaja, feltoltes, torles |
| ``#delete-doc-confirm-modal`` | Dokumentum torlesene megerosito modal |
| ``#add-building-modal`` | Uj tarsashaz letrehozasa |
| ``#building-selector-modal`` | Epuletek kozotti valtas |
| ``#financial-situation-modal`` | A ház pénzügyi helyzete (lakói fullscreen nézet): Társasház tartalékai (KK, FA, Összesen), az előző 3 hónap havi pénzügyi mérlegei (Bevétel, Kiadás, Margó), és a lakásonkénti nyilvános tartozástérkép |
| ``#flats-data-modal`` | **Lakások adatai** (KK fullscreen nézet): Letisztult csempés áttekintő a lakások számával és tulajdonosainak nevével (mint a főoldalon), ahol a csempére kattintva nyitható meg a szerkesztő modal |
| ``#edit-flat-master-modal`` | **Lakás törzsadatai szerkesztő popup**: Felugró ablak a lakás összes alapadatának (tulajdonos, e-mail, telefon, alapterület, tulajdoni hányad, lakók száma, garázs/tároló, vészhelyzeti kontakt, levelezési cím) kényelmes módosításához és mentéséhez |

---

## Kulcsfuggvenyek

### Dashboard rendereles

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``renderAdminDashboard()`` | ~2333 | Fo render-fuggveny: KPI-k, arrears matrix, tranzakcio-lista frissitese egyetlen hivassal |
| ``renderArrearsMatrix()`` | ~2398 | Lakas tile-kartya-grid generalasa; voros kiemeleses ha hatral ek van; Admin modban gyors-befizetes gombok (KK/FA) |
| ``renderFlatsDataModal()`` | ~6780 | A KK Lakások adatai letisztult névkártyáinak dinamikus kirajzolása és kereső-szűrése |
| ``openEditFlatMasterModal(buildingId, flatNum)`` | ~6900 | Egy adott lakás törzsadat popupjának megnyitása alapértelmezett olvasási (Read-Only) nézetben |
| ``toggleFlatMasterEditMode(force)`` | ~6915 | Törzsadat szerkesztési mód ki/bekapcsolása a fejlécben vagy láblécben lévő ceruza gombra kattintva |
| ``renderFlatMasterModalContent()`` | ~6925 | Törzsadat popup kirajzolása olvasási nézetben (kártyák) vagy szerkesztési nézetben (input mezők) |
| ``resetFlatPasswordFromMasterModal(flatNum)`` | ~7060 | A lakás jelszavának azonnali visszaállítása a kezdő "lakas123" értékre |
| ``saveFlatMasterFromModal()`` | ~7085 | A felugró ablakban módosított törzsadatok mentése a memóriába, LocalStorage-ba és Firebase felhőbe |
| ``renderAdminTransactions(showAll)`` | ~2929 | Tranzakciok + kiadasok egyesiett listaja; az elso 5-ot mutatja, tobb eseten "Mutasd az ossz" link |
| ``initAdminFormDropdowns()`` | ~2377 | Befizetes-urlap lakas-select + datum feltoltese |
| ``renderBudgetPlanner()`` | - | Koltsegvetesi terv / prognozis megjelenites |

### Lakas-kezeles

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``openFlatDetailModal(flatNum)`` | ~3247 | Lakás adatlap megnyitása: fejlécként a tulajdonos neve, e-mail címe és lakók száma, alatta egyenlegek és tranzakció-idővonal |
| ``closeFlatDetailModal()`` | ~2924 | Lakas-modal bezarasa |
| ``toggleFlatEditMode(force)`` | ~3400 | Havi előírások és egyenlegek szerkesztési módjának be/ki kapcsolása |
| ``toggleGridEditMode()`` | ~3100 | Admin rács szerkesztési mód: megjelenik az "Új lakás" gomb, valamint a csempék szerkesztés és törlés gombjai |
| ``openAddFlatModal()`` | ~3648 | Uj lakas-hozzadasi modal megnyitasa |
| ``#add-flat-form submit`` listener | ~3657 | Uj lakas letrehozasa: state.flats-be fuzzi, uj User-t hoz letre lakas123 alap-jelszoval |
| ``confirmDeleteFlat()`` | ~3716 | Lakas torlese: Permanent Vault deletedFlatNums-be teszi, state.flats + state.users-bol eltavolitja |

### Dijvaltozas-kezeles

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``checkFeeChange(type)`` | ~3535 | KK vagy FA dijeloiras modositasat erz ekeli; felajanlja az ervenyessegi datum beallitasat |
| ``flat.feeChangesKK.push({ date, amount })`` | ~3540 | Uj dijvaltozas hozzaadasa a torteneti tombhoz |
| ``getCurrentFee(flat, type)`` | ~1066 | Az aktualis dijeloir-ast szamitja (legfrissebb feeChange alapjan) |

### Dokumentum-kezeles

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``#doc-upload-form submit`` | ~4396 | Fajl feltoltese FileReader.readAsDataURL() segitsegevel; az eredmeny Base64 string a ``doc.fileData`` mezoben |
| ``renderDocumentsList()`` | ~1927 | Dokumentumlista renderelese: kategoria-szuro, keres, letoltes + torles gombok (torles csak admin-nek) |
| ``openDeleteDocModal(docId)`` | ~2032 | Dokumentum torles megerosito modal megnyitasa |
| ``confirmDeleteDocument()`` | ~2064 | Dokumentum torlese: vault-ba kerul az ID (blacklist), state.buildings + state.documents-bol eltavolitja |
| ``downloadDocument(docId)`` | ~2005 | Letoltes: Base64 fajl vagy szoveges placeholder (lasd Resident Portal) |

### Tranzakcio es kiadas kezeles

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``#add-payment-form submit`` | ~3218 | Uj befizetes (Transaction) rogzitese: ``state.transactions.unshift(newTx)`` |
| ``#add-expense-form submit`` | ~3252 | Uj kiadas (Expense) rogzitese: ``state.expenses.push(newExpense)`` |
| ``openEditModal(id, type)`` | - | Szerkesztesi modal elotoltese a kivalasztott tranzakciohoz/kiadashoz |
| ``#edit-transaction-form submit`` | - | Modositott mezo(k) mentese az eredeti id alapjan |
| ``deleteTransaction(id, type, ...)`` | ~4082 | Megerosito modal megnyitasa torles elott |
| ``confirmDeleteTx()`` | ~4109 | Torles: state.transactions / expenses / manualDebits tombokbol + vault blacklist-re kerul |
| ``toggleAdminTxEditMode()`` | ~3032 | Admin tranzakcio-lista szerkesztesi mod be/ki |
| ``quickAddPayment(flatNum, type)`` | - | Gyors-befizetes gomb a tile-kartyan: modal elotoltese az adott lakas + szamla adataival |
| ``openGlobalBalancesModal()`` | ~3745 | KK/FA szamlafooosszeg beallito modal megnyitasa |
| ``setFlatAddTxType(type)`` | ~5263 | Tétel rögzítésekor a Befizetés (+) és Terhelés (-) közötti modern szegmentált kapcsoló váltása és űrlap-opciók frissítése |
| ``setTransactionModalType(type)`` | ~4345 | Új tranzakció rögzítésekor a Befizetés (+) és Terhelés / Kiadás (-) közötti modern szegmentált kapcsoló váltása |
| **Egyéb megjegyzés mező** | ~6396, ~7120, ~7215 | A lakás adatlapokon a korábbi "Levelezési cím" helyét az "Egyéb megjegyzés" (``flat.notes``) vette át, alkalmas bérlői adatok, megjegyzések tárolására |
| **Terasz / Loggia (m²) paraméterezés** | ~4424, ~7090, ~7175 | Minden lakásnál beállítható és megtekinthető a terasz vagy loggia területe négyzetméterben (``flat.terraceArea`` / ``flat.balconyArea``) mind új lakás létrehozásakor, mind a törzsadatok szerkesztésekor |
| **Dinamikus Többgarázsos (m²) Kezelés** | ~7000, ~7235, ~7475 | A garázsok nem sorszámként, hanem négyzetméter alapon rögzíthetők (``flat.garages`` tömb). Dinamikus sorkezelővel tetszőleges számú garázs adható hozzá egyetlen lakáshoz, összesített és tételes m² kimutatással |
| **Letisztult Modál Fejléc & Jobb Felső Bezárás** | ~7125 | A lakás törzsadat ablak fejlécéből kikerült a felesleges felső ceruza gomb (a láblécben lévő nagy Szerkesztés gomb elegendő). Mobilon az ablakok jobb felső sarkában fixen, sortörés nélkül helyezkedik el a kis [X] bezáró gomb |
| **2-es lakás Eredeti Értékek Helyreállítása** | ~500, ~634, ~1515 | A 2-es lakás eredeti adatai (Közös Költség: 0 Ft, Felújítási Alap: +3 572 Ft túlfizetés, 12 000 Ft kuka mozgatási tétel) maradéktalanul helyreállítva; az egyenlegkalkuláció (12 000 - 4 214 - 4 214 = +3 572 Ft) matematikai pontossággal működik |
| **Görgetési & Modál Architektúra** | - | A teljes képernyős (pl. Lakások adatai) és felugró ablakok kizárólag a belső ``modal-body`` konténert görgetik; megszüntettük a többszörös beágyazott görgetősávokat, letisztult egyedi vékony görgetősávot alkalmazva |
| **Modern Lebegő Toast Értesítések** | ~5720, ~7351 | A böngésző natív ``alert()`` felugró ablakai helyett automatikusan elhalványuló, modern sötét üveghatású (glassmorphic) lebegő értesítő sáv (Toast) tájékoztat a sikeres mentésről/műveletről (nem szükséges Ok-ézni) |
| **Mobil Viewport & Számmező védelem** | - | A modálok csak függőlegesen gördülnek (nincs 3D billenés/oldalra lógás), a számmezők léptetőnyilai és egérgörgős értékmódosítása globálisan le van tiltva |

---

## Adataram (State modosulas)

### Befizetes rogzitese

```
#add-payment-form submit
  |
  v
newTx = { id: "t-<timestamp>", flatNum, date, amount, method, status: "Verified",
           targetAccount, comment, includeInBalance }
state.transactions.unshift(newTx)
  |
  v
saveStateToLocalStorage() -> revision+1, localStorage, syncStateToCloud()
recalculateFlatBalances() -> flat.balance, flat.renovationBalance frissul
renderAdminDashboard()    -> KPI-k, matrix, lista frissul
```

### Uj lakas letrehozasa

```
#add-flat-form submit
  |
  v
state.flats.push({ flatNum, ownerName, email, monthlyFee, renovationFee, ... })
state.users.push({ id: "u-<timestamp>", role: "Owner", pass: "lakas123", ... })
  |
  v
saveStateToLocalStorage() -> szinkron
renderAdminDashboard()
```

### Dokumentum feltoltese (Base64)

```
#doc-upload-form submit
  |
  v
FileReader.readAsDataURL(file)
  |
  onload:
    newDoc = { id: "doc-<timestamp>", title, fileName, fileSize, fileType,
               uploadDate, fileData: "data:<mime>;base64,..." }
    curBuilding.documents.unshift(newDoc)
    recordItemInVault("document", newDoc)
    saveStateToLocalStorage() + syncStateToCloud()
    renderDocumentsList()
```

### Lakas dijvaltozas rogzitese

```
checkFeeChange("KK") / checkFeeChange("FA")
  |
  v
flat.feeChangesKK.push({ date: "YYYY-MM", amount: newFee })
flat.monthlyFee = newFee   // aktualis mezo is frissul
  |
  v
saveStateToLocalStorage() + syncStateToCloud()
renderAdminDashboard()
```