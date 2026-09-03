# Resident Portal – Lakoi nezet (tenant-view)

## Cel

A lakoi portal (Owner szerepkor) a bejelentkezett lako sajat lakasahoz tartozo penzugyi informaciokat jelenitimeg: KK es FA egyenlegek, havi eloiras, utalasi adatok, tranzakcio-elozmenyek, epuleti atlathato-sag, es dokumentum-letoltes. Az Owner csak a sajat adatait latja – mas lakasok adataihoz nem fer hozza.

---

## Erintett DOM elemek / Modalok

### Fo nezet (#tenant-view)

| Elem ID | Szerepe |
|---|---|
| ``#tenant-view`` | A lakói nézet fő container szekciója |
| ``#tenant-kk-card`` | Saját KK egyenleg + havi előírás + állapot-badge kártya |
| ``#tenant-fa-card`` | Saját FA egyenleg + havi előírás + állapot-badge kártya |
| ``#tenant-status-kk`` | KK egyenleg összeg (Ft) |
| ``#tenant-status-fa`` | FA egyenleg összeg (Ft) |
| ``#tenant-status-kk-badge`` | KK állapot-badge (Rendezett / Hátralék / Túlfizetés) |
| ``#tenant-status-fa-badge`` | FA állapot-badge |
| ``#tenant-monthly-fee-a-new`` | Havi KK előírás |
| ``#tenant-monthly-fee-b-new`` | Havi FA előírás |
| ``#kk-ref-name`` | KK kedvezményezett neve |
| ``#kk-ref-bank`` | KK bankszámlaszám |
| ``#tenant-payment-ref`` | KK utalási közlemény (másolható) |
| ``#fa-ref-name`` | FA kedvezményezett neve |
| ``#fa-ref-bank`` | FA bankszámlaszám |
| ``#tenant-payment-ref-b`` | FA utalási közlemény (másolható) |
| ``#tenant-tbody-combined`` | Tranzakció-táblázat tbody (KK + FA együtt, legújabb 5 tétel) |
| ``#tenant-tx-search`` | Kereső input a tranzakció-listában |
| ``#tenant-tx-show-all-row`` | "Teljes lista megtekintése" gomb sora |

### Modalok

| Modal ID | Szerepe |
|---|---|
| ``#documents-modal`` | Tarsashazi dokumentumok listaja es letoltes |
| ``#fullscreen-tx-modal`` | Teljes tranzakcio-elozme ny fullscreen nezetben |
| ``#building-selector-modal`` | Letisztult profil- és lakásváltó popup (Közös Képviselő / Társasház és lakásszám), ahol az éppen aktív profilt egyértelmű kék körvonal, fókuszgyűrű és pipa ikon jelzi |
| ``#profile-modal`` | Személyes profil nézet (fullscreen): fejlécben elhelyezett egységes Profilváltás gombbal; a lakói profilban fejlécbe integrált Jelszómódosítással, lakás alapadatokkal (alapterület, bejelentett lakók, garázs/tároló sorszámok), szerkeszthető és felhőbe menthető vészhelyzeti elérhetőségekkel (másodlagos kontakt, levelezési cím), valamint közvetlen Közös Képviselet gyorselérhetőséggel (+36 20 397 1253) |
| ``#financial-situation-modal`` | A ház pénzügyi helyzete (fullscreen nézet): Társasház tartalékai (KK, FA, Összesen), az előző 3 hónap havi pénzügyi mérlegei (Bevétel, Kiadás, Margó), és a lakásonkénti nyilvános tartozástérkép (előző hónap végi záró tartozás/egyenleg státuszcsempék) |
| ``#ios-side-drawer`` | iOS stílusú, jobb oldalról finom animációval becsúszó navigációs oldalsáv elmosott (blur) háttérrel, lekerekített menücsoportokkal és színes ikonokkal |

---

## Kulcsfuggvenyek

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``renderTenantDashboard()`` | ~1396 | Fo render-fuggveny: feltolti az osszes tenant-view elemet. Kiszamitja az egyenlegeket, utalasi adatokat, epuleti KPI-kat |
| ``saveResidentContactInfo(buildingId, flatNum)`` | ~6300 | A lakó által szerkesztett telefonszám, vészhelyzeti kontakt, és levelezési cím mentése LocalStorage-ba és Firebase RTDB-be |
| ``renderCombinedTenantTable(flatNum)`` | ~2097 | KK + FA idovonalat egyesitiegy ``_tenantCombinedData`` tombbo, datum szerint csokkeno rendbe rendezi |
| ``_renderTenantCombinedRows(data, previewOnly)`` | ~2116 | DOM sorok generalasa a tenant tablazatba; ``previewOnly=true`` eseten csak az elso 5 rekord jelenik meg |
| ``filterTenantCombinedTable(val)`` | ~2185 | Keresesi szuro: datum, osszeg, megjegyzes, szamla alapjan szuri ``_tenantCombinedData``-t |
| ``_tenantMatchesQuery(item, query)`` | ~2193 | Egy tranzakcio-elem egyeztetest vegzo segedfuggveny |
| ``openTenantFullscreen()`` | ~2204 | Megnyitja a ``#fullscreen-tx-modal``-t a lako sajat tranzakcioi nezeteben (``fullscreenType = 'flat'``) |
| ``downloadDocument(docId)`` | ~2005 | Ha a dokumentumhoz van ``fileData`` (Base64), programmatikus ``<a>`` kattintassal tolti le. Ha nincs, szoveges placeholdert general |
| ``openBuildingSelector()`` | ~1518 | Megnyitja az epulet/lakas-valto modalt |
| ``recalculateFlatBalances()`` | ~1135 | Minden lakas KK/FA egyenleget ujraszamolja a tranzakciok + eloirasok alapjan |
| ``getBuildingReserve()`` | ~1173 | Epulet ossz-KK egyenleget adja vissza |
| ``getBuildingRenovationFund()`` | ~1185 | Epulet ossz-FA egyenleget adja vissza |
| ``getBalanceBadgeHtml(balance)`` | ~1286 | HTML badge generalasa az egyenleg-allapothoz (Rendezett / Hatral ek / Tulfizetes) |
| ``getFlatLedgerTimeline(flatNum, account)`` | ~1081 | Flat-szintu idovonal: manualDebits + verified transactions, datum szerint rendezve, gurdulo egyenleggel |
| ``copyText(elementId)`` | ~1239 | Clipboard API: masol-as gombra kattintva kopiazza a bankszamlat / kozlemenyt |
| ``exportCombinedFlatLedgerToExcel()`` | ~4024 | SheetJS: KK + FA tranzakciok exportalasa ``.xlsx`` fajlba |
| ``window.renderDocumentsList()`` | ~1927 | Dokumentumok listajanak renderelese a modalon belul (szuro + kategoria alapjan) |
| ``window.goToMainMenu()`` | ~5234 | Visszavisz a Főmenübe: bezárja az összes fullscreen nézetet (Profil, Pénzügyi helyzet, Dokumentumok, Hitelek), minden modált és dropdown menüt, valamint helyreállítja az alapoldali görgetést |

---

## Adataram (State modosulas)

A lakoi nezet **csak olvassa** az allapotot – nem modositja. Kivetelek:

- **Epuletvaltas** (``openBuildingSelector``): ``state.currentBuildingId`` + ``getCurrentBuilding()`` -> shortcut-pointerek frissulnek -> ``saveStateToLocalStorage()``
- **Jelszocsere** (``handleChangePasswordSubmit``): ``state.users[i].pass`` + ``vault.flatOverrides``

```
renderTenantDashboard()
  |
  +-- recalculateFlatBalances()
  |     getFlatLedgerTimeline("Kozos Koltseg")
  |     getFlatLedgerTimeline("Felujitasi Alap")
  |     -> flat.balance, flat.renovationBalance frissul (in-memory)
  |
  +-- getBuildingReserve() / getBuildingRenovationFund()
  |     -> epulet-szintu KPI-k szamitasa (in-memory)
  |
  +-- DOM-elemek frissitese (nincs state-irasi mellekhatasa)
  |
  +-- renderCombinedTenantTable(flatNum)
        getFlatLedgerTimeline(x2) -> _tenantCombinedData felt oltes
        _renderTenantCombinedRows() -> DOM tablazat megjelenites
```

### Dokumentum-letoltes adatfolyam

```
downloadDocument(docId)
  |
  +-- curBuilding.documents.find(d => d.id === docId)
  |
  +-- HA doc.fileData letezik:
  |     <a href="data:...base64..." download="..."> programmatic click
  |
  +-- HA doc.fileData === null:
        szoveges placeholder Blob generalas
        URL.createObjectURL(blob)
        <a href="blob:..." download="..."> programmatic click
        setTimeout(() => URL.revokeObjectURL(url), 1000)
```

### Tranzakciós Bizonylatok és Számlák elérése

A lakó a saját tranzakciós listájában és a teljes képernyős tranzakció-előzményekben minden olyan tételnél, amelyhez a Közös Képviselő vagy a rendszer számlát/bizonylatot csatolt, látja a csatolmány jelvényét (`.tx-attachment-badge`), melyre rákattintva közvetlenül letöltheti a számla vagy banki bizonylat PDF/kép fájlját.