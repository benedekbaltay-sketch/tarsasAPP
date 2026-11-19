# 🏦 OTP Bank Corporate API Integrációs Útmutató és Checklista

Ez a dokumentum a **TarsasApp** és az **OTP Bank Corporate API (Electra / Open Banking)** közötti kétirányú, tanúsítványos (mTLS) integráció lépésről lépésre követhető technikai és adminisztratív útmutatója.

---

## 📋 Integrációs Fázisok Áttekintése

| Fázis | Feladat | Felelős | Státusz |
| :--- | :--- | :--- | :--- |
| **1. Fázis** | 4096 bites RSA kulcspár és 10 éves tanúsítvány legenerálása | Fejlesztő / Rendszer | ✅ **Kész** (`server/certs/`) |
| **2. Fázis** | OTP 3.1.1 tanúsítványlánc validáló és mTLS backend elkészítése | Fejlesztő / Rendszer | ✅ **Kész** (`server/otpApiClient.js`) |
| **3. Fázis** | Hivatalos regisztrációs kérelem elküldése az OTP-nek e-mailben | Közös Képviselő | ⏳ **Végrehajtásra vár** |
| **4. Fázis** | Electra Kiegészítő Megállapodás aláírása és benyújtása | Közös Képviselő | ⏳ **Végrehajtásra vár** |
| **5. Fázis** | A bank által kiadott `client_id` és `client_secret` rögzítése a `.env`-ben | Fejlesztő / KK | ⏳ **Függ a 3-4. fázistól** |
| **6. Fázis** | Éles szinkronizáció indítása az alkalmazás felületéről | Közös Képviselő | 🚀 **Azonnal elérhető** |

---

## 1. Fázis: Tanúsítványlánc Szabályzat (OTP Szabályzat 3.1.1)

Az OTP Bank Corporate API biztonsági előírása (3.1.1 pont) szerint az mTLS hitelesítéshez használt PEM tanúsítványfájlnak a teljes tanúsítványláncot kell tartalmaznia az alábbi **szigorú hierarchikus sorrendben**:

```text
1. Root CA (Gyökér tanúsítvány)
   └── 2. Intermediate CA (Közbenső tanúsítvány, ha a hitelesítésszolgáltató alkalmazza)
        └── 3. Kliens / Szerver tanúsítvány (Leaf cert, amelyhez a privát kulcs tartozik)
```

### A repóban található fájlok helye:
- `server/certs/otp_cert.pem`: A banknak átadandó **publikus X.509 tanúsítvány** (RSA 4096 bit, érvényes: 2026–2036).
- `server/certs/otp_private.key`: A backend által használt **titkos privát kulcs**.
- `server/certs/otp_public.pem`: Kinyert nyilvános kulcs.

> [!CAUTION]
> **SZIGORÚ BIZTONSÁGI SZABÁLY:**
> A privát kulcsot (`otp_private.key`) **TILOS ELKÜLDENI A BANKNAK VAGY BÁRMILYEN HARMADIK FÉLNEK!**
> A banknak **kizárólag a publikus tanúsítványt (`otp_cert.pem`)** szabad átadni. A privát kulcs kizárólag a saját, védett szervereden futó Node.js backend (`server/certs/`) könyvtárában maradhat, amit a `.gitignore` véd a verziókövetés elől.

---

## 2. Fázis: E-mail Sablon a Banknak (`corpapisupport@otpbank.hu`)

Küldd el az alábbi e-mailt a társasház hivatalos kapcsolattartási e-mail címéről az OTP Corporate API támogatásának:

---

**Címzett:** `corpapisupport@otpbank.hu`  
**Másolatot kap (CC):** *(Közös képviseleti iroda e-mail címe)*  
**Tárgy:** `OTP Corporate API regisztrációs kérelem és tanúsítvány benyújtása – Batyu utca 21. Társasház`  

**Melléklet:** `server/certs/otp_cert.pem` *(Csatold a generált publikus tanúsítványfájlt!)*

---

**Tisztelt OTP Bank Corporate API Támogatás!**

Alulírott, mint a(z) **Batyu utca 21. Társasház** törvényes közös képviselője, ezúton kérem az **OTP Corporate API (Electra Open Banking)** hozzáférés beállítását és a csatolt kliens tanúsítvány regisztrálását a társasházunk bankszámlájához.

### 1. A társasház és a bankszámla adatai:
- **Társasház hivatalos neve:** Batyu utca 21. Társasház
- **Székhely / Cím:** 1025 Budapest, Batyu utca 21.
- **Társasház adószáma:** 28941235-1-41 *(kérjük ellenőrizni / pontosítani)*
- **Számlavezető bank:** OTP Bank Nyrt.
- **Bankszámlaszám (KK főszámla):** HU42 1177 3016 0000 1234 0001 0000 *(kérjük pontosítani a valós IBAN-ra)*
- **Electra szerződésszám / ügyfélszám:** *(amennyiben ismert)*

### 2. Technikai Kapcsolattartó adatai:
- **Kapcsolattartó neve:** *(Pl. Benedek / Közös Képviselő vagy Rendszergazda neve)*
- **E-mail cím:** `benedek@example.com` *(a valós technikai e-mail cím)*
- **Telefonszám:** `+36 ...`
- **Szerver fix külső IP-címe (ha whitelist szükséges):** *(Saját szerver fix IP címe, vagy jelezni, ha dinamikus/felhő alapú)*

### 3. Csatolt tanúsítvány paraméterei (OTP 3.1.1 szabvány):
- **Tanúsítvány fájl:** `otp_cert.pem` *(csatolva)*
- **Kulcshossz:** RSA 4096 bit
- **Érvényesség:** 10 év (2026.11.18. – 2036.11.15.)
- **Tárgy (Subject):** `C=HU, ST=Budapest, L=Budapest, O=TarsasApp, OU=OpenBanking, CN=TarsasApp OTP Client`
- **Ujjlenyomat (SHA-256):** `8E:AD:04:E6:0B:B5:D3:91:AD:EF:B7:E8:4F:19:4B:42:7B:7B:3B:7F:8B:77:3A:04:DD:07:0A:53:2E:A5:5A:FC`

### 4. Igényelt API modulok / Szolgáltatások:
- **Számlainformáció és egyenleglekérdezés (AISP - Account Information Services)**
- **Napi könyvelési számlatörténet és tranzakciók letöltése (CAMT.052 / CAMT.053 formátumban)**

Kérjük a tanúsítvány rendszerükben történő aktiválását, valamint a teszteléshez és az éles használathoz szükséges **Client ID** (`client_id`) és **Client Secret** (`client_secret`), illetve az éles végpontok megküldését.

Együttműködésüket előre is köszönjük!

Üdvözlettel,  
**[Közös Képviselő / Képviseleti Cég Neve]**  
Közös Képviselő  
Batyu utca 21. Társasház  
Tel: +36 ...  
E-mail: ...  

---

## 3. Fázis: Az Electra Kiegészítő Megállapodás Benyújtása

Az OTP Corporate API használatához a bank megköveteli az **Electra Kiegészítő Megállapodás (Corporate API Szerződés)** hatályba lépését.

### Lépések:
1. **Szerződés igénylése:**
   - A `corpapisupport@otpbank.hu` címre küldött e-mail után a bank megküldi a kitöltendő formanyomtatványt, vagy a számlavezető OTP fiókban személyesen / Electra felületen keresztül kérhető.
2. **Képviseleti jogosultság igazolása:**
   - Csatolandó a közgyűlési jegyzőkönyv kivonata a közös képviselő megválasztásáról és aláírási címpéldány / képviseleti meghatalmazás.
3. **Aláírás és leadás:**
   - Az OTP fiókban személyesen aláírva, vagy AVDH / minősített elektronikus aláírással hitelesítve küldhető vissza a banknak.
4. **Átfutási idő:**
   - Általában 3–5 munkanap a jóváhagyás és a jogosultság aktiválása.

---

## 4. Fázis: Hitelesítő Adatok Beállítása a TarsasAppban

Miután az OTP Bank megküldte a jóváhagyást és az azonosítókat, nyisd meg a projekt gyökerében lévő `.env` fájlt:

```env
# 1. Állítsd be az éles vagy sandbox API végpontot
OTP_API_BASE_URL=https://api.otpbank.hu
OTP_AUTH_URL=https://api.otpbank.hu/auth/oauth2/token

# 2. Illeszd be a bank által küldött azonosítókat
OTP_CLIENT_ID=ide_jon_a_banktol_kapott_client_id
OTP_CLIENT_SECRET=ide_jon_a_banktol_kapott_client_secret

# 3. Tanúsítványok helye (már előre konfigurálva)
OTP_CERT_PATH=./server/certs/otp_cert.pem
OTP_KEY_PATH=./server/certs/otp_private.key
```

---

## 5. Fázis: Rendszerindítás és Tranzakció-Szinkronizáció

### 1. Backend szerver elindítása:
```bash
npm run server
```
A szerver automatikusan betölti a tanúsítványláncot és figyeli a bejövő szinkronizációs kéréseket az `http://localhost:5001` címen.

### 2. Kapcsolat és tanúsítványlánc tesztelése parancssorból:
```bash
node server/testOtpConnection.js
```
A script ellenőrzi a tanúsítványlánc 3.1.1 szerinti sorrendjét, a privát kulcs épségét, és lefutat egy mTLS kézfogást a banki szerverrel.

### 3. Használat a Webalkalmazásban:
1. Nyisd meg a TarsasAppot: `https://tarsashaz-cfe5d.web.app` (vagy helyben `npm run dev`).
2. Nyisd meg az adott társasházat (pl. *Batyu utca 21.*).
3. A felső sávban kattints a **`[ 📂 Banki importálás / Excel feltöltés ]`** gombra.
4. Válaszd ki az **OTP Bankot** (alapértelmezettként mentődik a házhoz).
5. Kattints a zöld **`[ 🔄 Banki szinkronizálás indítása ]`** gombra.
6. A rendszer az mTLS végponton keresztül azonnal letölti a friss banki kivonatot, lefuttatja a **Smart Matching** felismerőt, és megnyitja a **Review Wizard** felületet a tételek egyenkénti vagy csoportos lekönyveléséhez.

---

## 6. Fázis: Gyakori Kérdések és Hibaelhárítás

- **Q: Mit jelent az `ENOTFOUND sandbox.api.otpbank.hu` hiba a teszt során?**  
  *Válasz:* A bank Sandbox címe még nincs regisztrálva a nyilvános DNS-ben, vagy belső banki hálózaton / specifikus aldomainen működik, amit az OTP a regisztráció visszaigazolásakor pontosít.
- **Q: Mit tegyek, ha az OTP hitelesítésszolgáltatótól (pl. Microsec e-Szignó vagy NetLock) származó 3 részes tanúsítványláncot kapok?**  
  *Válasz:* Egyszerűen másold be a kapott tanúsítványokat a `server/certs/otp_cert.pem` fájlba. A rendszerben lévő `validateOtpCertificateChain()` és `reorderOtpCertChain()` függvények automatikusan ellenőrzik és az OTP 3.1.1 szerinti [Root CA -> Intermediate CA -> Kliens] sorrendbe rendezik azokat!
- **Q: Szükséges-e a képviselőnek minden szinkronizáláskor jelszót megadnia?**  
  *Válasz:* Nem. Az mTLS tanúsítványos hitelesítés automatikus és kriptográfiailag védett háttérkommunikációt biztosít, így a szinkronizáció egyetlen kattintással végrehajtható.
