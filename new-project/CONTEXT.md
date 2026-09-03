# Rendszer Kontextus es Fejlesztesi Iranyelv – Tarsashazi Portal

## 1. Projekt Attekintes

Egy egyoldalas webalkalmazas (SPA) tarsashazak kezelesere: lakoi felulet, kozos kepviseleti adminisztracio, penzugyi nyilvantartas es dokumentumtar.

- **Tech Stack:** Vanilla JavaScript (ES6+), HTML5, CSS3, Firebase Realtime Database (RTDB) [Firestore inaktív], SheetJS, Lucide Icons.
- **Architektura:** DOM-lathatosag alapu SPA (``#login-view``, ``#tenant-view``, ``#admin-view``), globalis ``state`` objektum 3-retegu perzisztenciaval (RTDB + localStorage + Permanent Vault) es reviziokovetessel.

## 2. AI Fejlesztesi Szabalyok (Szigoruan betartando)

1. **Allapot es Perzisztencia vedelme:** Ne modositsd a mentesi es reviziokovetesi logikat (``revision``, ``lastUpdated``) anelkul, hogy ellenorizned a ``docs/database-schema.md`` szabalyait.
2. **Kezdo szinkronizacios flag vedelme:** A ``_cloudInitialSyncDone`` flag deklaracioja es allitasa kritikus fontossagu a kezdeti betolteskor. Soha ne torold vagy modositd a mukodeset, kulonben az uj felhasznalok ures state-je felulirhatja a felho-adatokat.
3. **Penzugyi kalkulaciok erintetlensege:** A ``ManualDebit``, ``Expense`` es ``Transaction`` tipusok kozotti szamitasi kulonbsegeket kotelezo betartani a ``docs/features/finances.md`` alapjan.
4. **DOM es Script izolacio:** Mivel 100+ segedscript es 10 modal letezik, uj logikat ne omleszd egybe; keresd meg a megfelelo komponenst/fuggvenyt.
5. **Tervezes kodolas elott:** Nagyobb modositas elott mindig keszits egy rovid, lepesrol lepesre kovetheto megvalositasi tervet.
6. **Dokumentacio karbantartasa:** Ha uj modalt, state mezot vagy fuggvenyt hozol letre/modositasz, a vonatkozo al-dokumentaciot is frissiteni kell a feladat vegen.

## 3. Dokumentacios Halo Terkep (Dokumentum-Router)

Mielott modositast vegzel a kodban, olvasd el a feladathoz tartozo specifikaciot:

- **Globalis Rendszer & Routing:** ``docs/architecture.md``
- **Adatmodellek, State & Jogosultsagok:** ``docs/database-schema.md``
- **Modulok es Funkciok:**
  - Belep-es, autentikacio, jogosultsagi szintek: ``docs/features/auth-and-roles.md``
  - Lakoi nezet, sajat egyenleg, letoltesek, hibak: ``docs/features/resident-portal.md``
  - Adminisztracio, lakaskezeles, kozlemenyek, feltoltes: ``docs/features/admin-management.md``
  - Tranzakciok, kiadasok, kalkulaciok, Excel export: ``docs/features/finances.md``