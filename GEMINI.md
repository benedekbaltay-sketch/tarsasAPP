# STRICT PROJECT RULES FOR TARSASAPP

A portál fejlesztése és karbantartása során az alábbi 4 alapszabály és védelmi irányelv kötelező érvényű minden agent és fejlesztő számára:

---

## 1. 🌐 KÉTNYELVŰSÉGI SZABÁLY (BILINGUAL MANDATE)
- **Mindent angolra is le kell fordítani**, hogy a felhasználó zökkenőmentesen tudjon váltani a magyar (`hu`) és az angol (`en`) nyelv között.
- Bármilyen új felhasználói felület, gomb, címke, űrlap, hibaüzenet, értesítés vagy tájékoztató szöveg hozzáadásakor kötelező mind a magyar, mind az angol szótárt frissíteni a `src/constants/translations.js` fájlban.
- Nem maradhat kevert nyelvű vagy lefordítatlan felület az alkalmazásban.

---

## 2. 📚 DOKUMENTÁCIÓS SZABÁLY (DOCUMENTATION MANDATE)
- **Mindent dokumentálni kell.** A rendszer dokumentációját (`docs/`, `AGENT.md`, `GEMINI.md`) minden változás, új funkció, séma- vagy képletmódosítás esetén kötelező azonnal bővíteni és frissíteni.
- **Mankóként és segédletként kell használni:** Minden új feladat megkezdése előtt kötelező áttekinteni a releváns dokumentációt, hogy a fejlesztő és AI asszisztens a rendszer minden aspektusát pontosan ismerje, és arra építve végezze el a módosításokat.

---

## 3. 🛑 SZIGORÚ ADATBÁZIS-MÓDOSÍTÁSI ÉS JÓVÁHAGYÁSI SZABÁLY (STRICT DATA PERMISSION MANDATE)
**AZ ADATBÁZISBAN (Firebase RTDB, LocalStorage, mock állapot) LÉVŐ ADATOKBA BELENYÚLNI SZIGORÚAN TILOS, CSAK AKKOR SZABAD, HA ERRE A FELHASZNÁLÓ EXPLICITE UTASÍTÁST AD! HA NEM AD UTASÍTÁST, TILOS VÁLTOZTATNI RAJTA.**

1. **Tilos automatikus tesztekből éles adatot írni/törölni:**
   - Semmilyen automatizált böngésző script (pl. headless browser), teszt script vagy CLI script NEM módosíthatja az éles adatbázist (`https://tarsashaz-cfe5d.web.app`, Firebase RTDB).
   - Tesztek kizárólag mock / memória adatokkal futhatnak. Soha nem szabad kattintani a "Befizetés", "Mentés", "Törlés" gombokra az éles rendszerben automatizált scripttel.

2. **Kötelező előzetes felhasználói jóváhagyás adatbázis-művelet előtt:**
   - Bármilyen könyvelési tétel (befizetés, kiadás, terhelés, előírás), lakásadat, felhasználó vagy induló számlaegyenleg hozzáadása, módosítása vagy törlése előtt az AI asszisztensnek **mindig meg kell kérdeznie a felhasználót, és kizárólag explicit jóváhagyással végezheti el**.

3. **Állandó és visszavonhatatlan érvényesség:**
   - Ez a szabály a projekt minden jelenlegi és jövőbeli beszélgetésére, minden feladatra és minden asszisztensre kötelező érvényű.

---

## 4. 🔒 ADATBIZTONSÁG ÉS FELTÖRHETETLENSÉG (SECURITY & INVIOLABILITY MANDATE)
- **Mindig arra kell törekedni, hogy az adatbiztonság és a feltörhetetlenség előre haladjon.**
- Minden fejlesztési lépésnél figyelembe kell venni a legmagasabb biztonsági szabványokat (hitelesítés, jogosultságkezelés, adatizoláció, bemeneti adatok fertőtlenítése).
- **Proaktív biztonsági javaslattétel:** Amennyiben a rendszerben gyenge pont, sebezhetőség vagy kockázat merül fel (pl. hozzáférési szabályok, jelszókezelés, jogosultsági szintek terén), az AI asszisztensnek és fejlesztőnek haladéktalanul javaslatot kell tennie a hibák elhárítására és a védelem megerősítésére.

---

## 5. 🛡️ LEGACY KÓD VÉDELME
- A `new-project/` mappa a korábbi verzió archívuma, szigorúan **csak olvasható**, soha semmilyen körülmények között nem módosítható.

