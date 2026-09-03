# Finances – Tranzakciok, egyenlegek, SheetJS export

## Cel

A penzugyi modul kezeli a harom tranzakcios tipust (Transaction, Expense, ManualDebit), a lakas-szintu es epulet-szintu egyenlegek szamitasat, a havi statistika szamitasat, a dijvaltozasok idovonal-nyomkovetesat, es az Excel-export/import muveleteket a SheetJS (xlsx) konyvtar segitsegevel.

---

## Erintett DOM elemek / Modalok

### Befizetes rogzitese (#transaction-modal)

| Elem ID | Szerepe |
|---|---|
| ``#transaction-modal`` | Befizetes + kiadas rogzitesi modal |
| ``#add-payment-form`` | Befizetes urlap |
| ``#payment-flat`` | Lakas-select (lakasok + "Egyeb/Global" opcio) |
| ``#payment-date`` | Datum (alapert.: mai nap) |
| ``#payment-amount`` | Osszeg (Ft) |
| ``#payment-method`` | Befizetes modja (Bank Transfer / Cash Offset) |
| ``#payment-target-account`` | Cel-szamla (Kozos Koltseg / Felujitasi Alap) |
| ``#payment-comment`` | Megjegyzes |
| ``#payment-include-balance`` | Checkbox: bele szamit-e az egyenlegbe |
| ``#add-expense-form`` | Kiadas urlap |
| ``#expense-category`` | Kiadas kategorija (Utility/Insurance/Maintenance/Bank Fee/Other) |
| ``#expense-date`` | Datum |
| ``#expense-amount`` | Osszeg (Ft) |
| ``#expense-provider`` | Cel-szamla (egyben a "szolgaltato" mezo) |
| ``#expense-comment`` | Megjegyzes |
| ``#expense-include-balance`` | Checkbox: bele szamit-e az egyenlegbe |

### Lakas-szintu tetel (#flat-detail-add-tx-modal)

| Elem ID | Szerepe |
|---|---|
| ``#flat-detail-add-tx-modal`` | Lakas-specifikus vagy Global tetel rogzitese |
| ``#flat-add-tx-type`` | Tipus (Befizetes / Terheles) |
| ``#flat-add-tx-account`` | Szamla (KK / FA) |
| ``#flat-add-tx-date`` | Datum |
| ``#flat-add-tx-amount`` | Osszeg (Ft) |
| ``#flat-add-tx-category`` | Kategoria (csak Terheles eseten latszik) |
| ``#flat-add-tx-comment`` | Megjegyzes |
| ``#flat-add-tx-include-balance`` | Checkbox: bele szamit-e az egyenlegbe |

### Szerkesztes (#edit-transaction-modal)

| Elem ID | Szerepe |
|---|---|
| ``#edit-transaction-modal`` | Tranzakcio szerkesztesi modal |
| ``#edit-tx-id`` | Rejtett mezo: szerkesztett elem ID |
| ``#edit-tx-type`` | Rejtett mezo: Befizetes / Kiadas |
| ``#edit-tx-date``, ``#edit-tx-amount``, ``#edit-tx-comment`` | Szerkesztheto mezok |
| ``#edit-tx-category``, ``#edit-tx-target-account`` | Kategoria / szamla kivalaszto |
| ``#edit-tx-include-balance`` | Checkbox |

### Egyenleg-beallitas (#global-balances-modal)

| Elem ID | Szerepe |
|---|---|
| ``#global-balances-modal`` | Kezdoegyenleg-korrekcios modal |
| ``#global-start-common`` | Kivan KK egyenleg (Ft) |
| ``#global-start-renovation`` | Kivan FA egyenleg (Ft) |

---

## Kulcsfuggvenyek

### Adatszamitasi motor

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``getLedgerMonths(startDateStr)`` | ~1185 | Dinamikusan legeneralja a honapok listajat (alapertelmezetten 2026-09-01-tol kezdve) az aktualis napig/honapig ketnyelvu megnevezesekkel |
| ``getFlatLedgerTimeline(flatNum, account)`` | ~1225 | Lakas-szintu idovonal: havi dinamikus eloirasok (KK/FA, 2026-09-01-tol havi rendszeresseggel, a beallitott osszeggel, pl. 0 Ft eseten 0 Ft) + manualDebits + verified transactions. Datum + ID alapjan rendez. Gurdulo egyenleget szamit (``runningBalance``) |
| ``recalculateFlatBalances()`` | ~1305 | Minden lakas KK es FA egyenleget ujraszamolja a teljes idovonal alapjan: ``flat.balance``, ``flat.renovationBalance``, ``totalRequired``, ``totalPaid`` |
| ``getBuildingReserve()`` | ~1345 | Epulet KK egyenleg: ``buildingInitialReserveCommon + verified-KK-bevetel - KK-kiadas`` (``includeInBalance !== false`` filterrel) |
| ``getBuildingRenovationFund()`` | ~1357 | Epulet FA egyenleg: hasonlo logika az FA szamlara |
| ``getMonthlyStats(year, month)`` | ~1369 | Havi inflow (verified tranzakciok) + outflow (kiadasok) osszesitese; margin = inflow - outflow |
| ``getCurrentFee(flat, type)`` | ~1210 | Az aktualis KK vagy FA dijat adja vissza: ha van feeChangesKK/FA, a legfrissebb aktiv valtozas ervenyes; egyebkent flat.monthlyFee / flat.renovationFee (0 Ft eseten 0 Ft) |
| ``getCombinedFlatLedgerTimeline(flatNum)`` | ~3048 | KK + FA idovonalat egyesitiegy tombbo, kombinalt gurdulo egyenleggel |
| ``renderFinancialSituationModal()`` | ~6626 | Kirajzolja a társasház összesített tartalékait (KK zöld, FA zöld, Összesen kék), a havi pénzügyi mérlegek (Bevétel, Kiadás, Margó) előző 3 havi táblázatát, valamint a modal alján a kizárólag nyilvános adatokat tartalmazó lakásonkénti tartozástérképet az előző hónap utolsó napjának záró állapota szerint (lakásszám és összesített záró tartozás/egyenleg státuszcsempékben minden lakó számára). |

### Tranzakcio-rogzites

| Fuggveny / Handler | Sor | Leiras |
|---|---|---|
| ``#add-payment-form submit`` | ~3218 | Befizetes (Transaction) letrehozasa: ``state.transactions.unshift(newTx)`` |
| ``#add-expense-form submit`` | ~3252 | Kiadas (Expense) letrehozasa: ``state.expenses.push(newExpense)`` |
| ``#flat-detail-add-tx-form submit`` | ~4538 | Lakas-specifikus vagy Global tetel. Ha "Befizetes" -> Transaction. Ha "Terheles" -> ManualDebit (lakas egyenleget csokkenti, epulet keszletet NEM terheli) |
| ``openEditModal(id, type)`` | - | Szerkesztendo elem megkeresese state.transactions-ban vagy state.expenses-ben; urlap elotoltese |
| ``#edit-transaction-form submit`` | - | Az eredeti objektum mezeinek helyszini frissitese az ID alapjan |
| ``confirmDeleteTx()`` | ~4109 | Sorban ellenorzi: state.transactions -> state.expenses -> state.manualDebits -> havi eloiras (cancelledDebits-be kerul). Vault blacklist |

### Excel export (SheetJS)

| Fuggveny | Sor | Leiras |
|---|---|---|
| ``exportTransactionsToExcel()`` | ~2929+ | Admin tranzakcio-lista exportalasa: transactions + expenses egyesiitve, datum szerint rendezve, ``.xlsx`` kimenet |
| ``exportFlatDetailToExcel()`` | - | Lakas-reszletes nezet teljes tranzakcio-elozmenye (tartalmazza a havi eloirasokat is) |
| ``exportFlatLedgerToExcel(account)`` | ~4005 | Egyszamla (KK vagy FA) idovonalanak exportalasa |
| ``exportCombinedFlatLedgerToExcel()`` | ~4024 | KK + FA egyesiett idovonalanak exportalasa (lakoi nezetbol) |
| ``exportFullscreenToExcel()`` | ~3996 | Fullscreen-modalbeli export: a ``fullscreenType`` ertektol fuggoen a megfelelo exportalo fuggvenyt hivja |

---

## Harom tranzakcios tipus osszehasonlitasa

| Tulajdonsag | Transaction | Expense | ManualDebit |
|---|---|---|---|
| **Cel** | Befizetes egy lakashoz vagy epulethez | Epulet-szintu kiadas | Manualis terheles egy lakashoz |
| **ID-prefix** | ``t-<timestamp>`` | ``e-<timestamp>`` | ``d-manual-<timestamp>`` |
| **Tarolasi hely** | ``state.transactions[]`` | ``state.expenses[]`` | ``state.manualDebits[]`` |
| **Lakas egyenlegre hat?** | Igen (Credit) | Nem | Igen (Debit) |
| **Epulet KK/FA egyenlegere hat?** | Igen | Igen (levonoduk) | Nem |
| **targetAccount** | "Kozos Koltseg" / "Felujitasi Alap" | "Kozos Koltseg" / "Felujitasi Alap" | "Kozos Koltseg" / "Felujitasi Alap" |
| **status mezo** | "Verified" (kotelező) | Nincs | Nincs |
| **flatNum** | Lakas ID vagy "Global" | Nincs (epulet-szintu) | Lakas ID (kotelezo) |

---

## Egyenleg-szamitasi logika

### Lakas-egyenleg (KK peldaval)

```
getFlatLedgerTimeline(flatNum, "Kozos Koltseg")
  |
  v
1. Havi dinamikus eloirasok generalasa (getLedgerMonths):
   2026-09-01-tol kezdve minden honap 1-jevel generalodik.
   HA nem szerepel flat.cancelledDebits-ben:
     -> type: "Debit", amount: -getCurrentFee(flat, "KK")
     (Ha 0 Ft van beallitva, 0 Ft terheles rogzul)

2. ManualDebits szures: flatNum + targetAccount egyezes
   -> type: "Debit", amount: -abs(d.amount)

3. Verified transactions szures: flatNum + targetAccount + status:"Verified"
   -> type: "Credit" (vagy "Debit" ha tx.type === "Debit"), amount: tx.amount

4. Datum + ID alapjan rendezes (azonos datum eseten Debit az elso)
5. Gurdulo egyenleg szamitasa (baseline + osszeadasos szummazas)
6. Megforditas (legujabb elol)
```

> **Fontos elkulonites:** A havi dinamikus eloirasok kizarolag az egyedi lakas folyoszamla-idovonalan (Flat Detail Modal, Tenant View, Fullscreen Flat History) jelennek meg. A globalis epuletszintu penzugyi naploban (``#admin-transactions-tbody``) NEM jelennek meg, igy a bankszamla-mozgasok listaja tiszta marad.

### Epulet egyenleg (KK)

```
getBuildingReserve()
  |
  v
totalPayments = SUM(transactions WHERE status=="Verified"
                    AND targetAccount=="Kozos Koltseg"
                    AND includeInBalance !== false
                    AND type !== "Correction")

totalExpenses = SUM(expenses WHERE targetAccount=="Kozos Koltseg"
                    AND includeInBalance !== false)

result = buildingInitialReserveCommon + totalPayments - totalExpenses
```

### Havi marzs

```
getMonthlyStats(year, month)
  |
  v
monthStr = "YYYY-MM"

inflow  = SUM(transactions WHERE date.startsWith(monthStr)
              AND status=="Verified" AND type!="Correction"
              AND includeInBalance !== false)

outflow = SUM(expenses WHERE date.startsWith(monthStr)
              AND includeInBalance !== false)

margin = inflow - outflow
```

---

## SheetJS (xlsx) Excel export mu-kodese

```javascript
// 1. Adatok osszeallitasa JavaScript tomb-kent:
const data = timeline.map(item => ({
  "Datum": item.date,
  "Szamla": item.account,
  "Tipus": item.type === "Debit" ? "Eloiras" : "Befizetes",
  "Osszeg": item.amount,
  "Megjegyzes": item.comment || ""
}));

// 2. SheetJS munkafuzet keszitese:
const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Tranzakciok");

// 3. Fajl letoltese:
XLSX.writeFile(wb, "Tranzakciok.xlsx");
```

A SheetJS a ``<head>``-ben CDN-rol toltodik be (``xlsx.full.min.js`` v0.18.5).
Az import funkcioja jelenleg nincs implementalva – kizarolag export letezik.

---

## Adataram (State modosulas)

### Befizetes rogzitese

```
#add-payment-form submit
state.transactions.unshift(newTx)
saveStateToLocalStorage()    --> revision+1, localStorage, Firebase sync
recalculateFlatBalances()    --> flat.balance / renovationBalance frissitese
renderAdminDashboard()       --> KPI + matrix + lista ujrarajzolasa
```

### Kiadas rogzitese

```
#add-expense-form submit
state.expenses.push(newExpense)
saveStateToLocalStorage() + renderAdminDashboard()
```

### Manualis terheles (ManualDebit)

```
#flat-detail-add-tx-form submit (type="Terheles", flatNum != "Global")
state.manualDebits.push(newDebit)
saveStateToLocalStorage()
recalculateFlatBalances()    --> CSAK a lakas egyenlege valtozik
renderAdminDashboard()
openFlatDetailModal(flatNum) --> frissiti a lakas-modal nezetett
```

### Egyenleg-korrekcio (buildingInitialReserve)

```
#global-balances-form submit
  kivan_KK = input ertek
  jelenleg_netto_KK = SUM(tranzakciok WHERE includeInBalance !== false) - SUM(kiadasok WHERE includeInBalance !== false)
  state.buildingInitialReserveCommon = kivan_KK - jelenleg_netto_KK
  state.buildingInitialReserveRenovation = kivan_FA - jelenleg_netto_FA
saveStateToLocalStorage() --> vault.buildingInitialReserveCommon[buildingId] is frissul
renderAdminDashboard()
```

---

## Dokumentum- és Számlacsatolás Tranzakciókhoz

A rendszer lehetővé teszi, hogy bármilyen pénzügyi tétel (befizetés, közös kiadás, lakásszintű terhelés vagy egyéb tétel) rögzítésekor és utólagos szerkesztésekor bizonylatokat, számlákat és egyéb dokumentumokat csatoljunk:

### 1. Csatolmányok szerkezete
```javascript
{
    id: "t-1725134567890",
    flatNum: "Fsz 2",
    date: "2026-08-31",
    amount: 15000,
    targetAccount: "Közös Költség",
    comment: "Augusztusi befizetés",
    includeInBalance: true,
    attachments: [
        {
            id: "att-1725134568900-1234",
            fileName: "szamla.pdf",
            fileSize: "245 KB",
            fileType: "pdf",
            uploadDate: "2026-08-31",
            fileData: "data:application/pdf;base64,..."
        }
    ]
}
```

### 2. Támogatott funkciók
- **Feltöltés / Csatolás:** PDF, JPG, PNG, DOC, DOCX, XLS, XLSX formátumok közvetlen csatolása a rögzítési és szerkesztési ablakokban.
- **Előnézet és letöltés:** A csatolt dokumentumok a főoldali tranzakciós táblázatban, a lakás részletes folyószámla-idővonalában, a teljes képernyős tranzakciós nézetben és a lakói felületen is megjelennek jelvényként (`.tx-attachment-badge`), melyre rákattintva a fájl azonnal letölthető vagy megnyitható.
- **Szerkesztés:** Meglévő csatolmányok megtekintése, törlése és új fájlok hozzáadása az `#edit-transaction-modal`-ban.