# Auth and Roles – Belepesi folyamat es szerepkorok

## Cel

Kezeli a felhasznalok azonositasat (e-mail + jelszo par), a szerepkorallapot beallitasat, a jelszo-visszaallitasi folyamatot es a kijelentkezest. A belep-es soran donti el a rendszer, hogy a felhasznalo az Admin (admin-view) vagy Owner (tenant-view) nezetet kapja-e.

---

## Erintett DOM elemek / Modalok

| Elem / Modal ID | Szerepe |
|---|---|
| ``#login-view`` | Fo belepesi nezet (alapertelmezetten latszik) |
| ``#login-form`` | Belepesi urlapo (e-mail + jelszo) |
| ``#login-username`` | E-mail input mezo |
| ``#login-password`` | Jelszo input mezo (password peek gombbal) |
| ``#login-remember-me`` | "Maradjak bejelentkezve" jelölőnégyzet (LocalStorage munkamenet perzisztencia) |
| ``#login-error-msg`` | Hibauzenete pannel (rossz jelszo / e-mail) |
| ``#login-success-msg`` | Sikeres jelszo-reset utani visszajelzes |
| ``#forgot-password-modal`` | Jelszo-visszaallitasi modal (e-mail alapu) |
| ``#forgot-form-view`` | Elfelejtett jelszo urlap nezet |
| ``#forgot-success-view`` | Sikeres link-kuldesi visszajelzes |
| ``#reset-password-modal`` | URL-tokennel megnyilo uj jelszo beallito modal |
| ``#change-password-modal`` | Bejelentkezett felhasznalo jelszomodo sitasa |
| ``#logout-btn`` | Kijelentkezes gomb a menuben és fiókban |
| ``#quick-login-section`` | Demo gyors-bejelentkezes panel (linkre kattintas) |
| ``#header-user-name`` | Bejelentkezett felhasznalo neve a fejlecben |

---

## Kulcsfuggvenyek

| Fuggveny / Handler | Hely (sor) | Leiras |
|---|---|---|
| ``#login-form submit`` listener | ~3540 | Fo hitelesitesi motor. Emailt es jelszot osszevet a state.users tombel, kezeli a "Maradjak bejelentkezve" perzisztenciat, egysegesen beleptet |
| ``updateAppView()`` | ~1323 | Bejelentkezes utan donti el: login-view, admin-view vagy tenant-view jelenjen meg |
| ``window.performLogout()`` | ~3620 | Torli a munkamenet adatokat (tarsashaz_logged_in_user, tarsashaz_remember_me), ``state.currentUser = null``, es updateAppView() |
| ``openForgotPasswordModal()`` | ~4642 | Megnyitja az elfelejtett-jelszo modalt, elotolti az e-mail mezot |
| ``handleForgotPasswordSubmit()`` | ~4658 | E-mail alapjan keresi a felhasznalot, egyedi token generalas, link megjelenites |
| ``checkUrlPasswordReset()`` | ~5500 | Oldalbetoltesekor ellenorzi az URL ``?reset=<token>`` parameteret |
| ``openChangePasswordModal()`` | ~5410 | Bejelentkezett felhasználónak jelszómódosítási modál nyitása (a Profil fül legelső kártyájának fejlécébe integrált gombbal) |
| ``handleChangePasswordSubmit()`` | ~5425 | Regi jelszo ellenorzese, uj jelszo perzisztens mentese mindket profilhoz, vault-ba es Firebase RTDB-be |
| ``peekPassword(id, show)`` | - | Mutatja/elrejti a jelszo mezo tartalmat (nyomva tartas kozben) |
| ``getResidentFlats(identifier)`` | ~538 | Osszes epuletben keresi a megadott e-mailhez/lakasnumhoz tartozo lakasokat |
| ``window.updateProfileButtonVisibility()`` | ~5850 | Profil-valto gomb megjelenitesenek frissitese (tobb lakas eseten) |

---

## Hitelesitesi logika lepesrol lepesre

```
login-form submit
       |
       v
1. Benedek-specifikus admin/Owner kettos eset?
   (benedek.baltay@gmail.com)
   |-- jelszo === adminPass  -> Admin belep
   |-- jelszo === lakas123   -> Owner (Fsz 2) belep
       |
       v
2. Altalanos Owner hitelesites
   |-- state.users-ben keresi az emailt (admin kizarva)
   |   HA nem talal:
   |   |-- state.buildings-ben keresi flat.email alapjan
   |       HA talal: uj User objektumot keszit es state.users-be fuzzi
       |
       v
3. Jelszo egyeztetese
   |-- user.pass / user.password / "lakas123" (fallback)
   |-- Egyezes: state.currentUser = user masolata
   |            state.currentBuildingId beallitas
   |            getCurrentBuilding() -> shortcut-pointerek szinkronizalasa
   |            recalculateFlatBalances()
   |            saveStateToLocalStorage() + syncStateToCloud()
   |            updateAppView() -> admin-view VAGY tenant-view
   |-- Nem egyezik: login-error-msg megjelenites
```

---

## Szerepkorok

| Szerepkor | ``role`` ertek | Elindulo nezet | Elerheto funkciok |
|---|---|---|---|
| **Admin** | ``"admin"`` | ``#admin-view`` | Minden adat, minden muvelet |
| **Owner** | ``"Owner"`` | ``#tenant-view`` | Csak sajat lakas es epulet-atlathato-sagi adatok |

---

## Allapotvaltozas (State modosulas)

### Belep-es

```
state.currentUser  <- JSON.parse(JSON.stringify(user))  // deep copy
state.currentBuildingId  <- user.buildingId
state.flats / transactions / expenses / ...  <- getCurrentBuilding() szinkronizal
state.revision  += 1
state.lastUpdated  = Date.now()
-> localStorage["tarsashaz_state"]
-> Firebase RTDB + Firestore (szinkron)
```

### Kijelentkezes

```
state.currentUser  <- null
state.revision  += 1
-> localStorage["tarsashaz_state"]
-> updateAppView() -> #login-view megjelenites
```

### Jelszo-reset

```
user.pass  <- uj jelszo (state.users-ben)
vault.flatOverrides[flatNum].pass  <- uj jelszo (Permanent Vault-ban)
-> saveStateToLocalStorage() + syncStateToCloud()
```