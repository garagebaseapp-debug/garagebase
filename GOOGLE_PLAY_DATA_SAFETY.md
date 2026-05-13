# Google Play Data Safety - GarageBase osnutek

Zadnja posodobitev: 13. 5. 2026

Ta dokument je priprava za Google Play Console obrazec. Ni pravni nasvet. Pred oddajo v Play Console preveri dejansko stanje aplikacije in ga uskladi s `/privacy` in `/terms`.

Uradna izhodisca:

- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/9888076
- Google Play Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111

## 1. Kratek odgovor

GarageBase zbira uporabniske podatke, ker brez njih aplikacija ne more delovati. Podatki so vezani na uporabniski racun, vozila, zgodovino vozila, slike/dokumente, opomnike, push obvestila in osnovno diagnostiko.

Podatkov ne prodajamo. Podatki se obdelujejo pri ponudnikih infrastrukture, ki poganjajo aplikacijo, kot so Supabase, Vercel in ponudniki push/e-mail storitev.

## 2. Ali app zbira podatke?

Da.

Razlogi:

- uporabniski racun in prijava,
- shranjevanje vozil in zgodovine,
- slike in dokumenti,
- opomniki in push obvestila,
- diagnostika, varnost in odpravljanje napak.

## 3. Ali app deli podatke z drugimi podjetji?

Priporocen odgovor v Play Console: praviloma `No`, ce Google obrazec locuje "sharing" od obdelave pri service providerjih.

Pojasnilo:

- podatkov ne prodajamo,
- ne delimo jih za oglase,
- ne uporabljamo oglasnih SDK-jev,
- uporabljamo infrastrukturo, ki obdeluje podatke v imenu aplikacije.

Ce Play Console zahteva oznacitev ponudnikov infrastrukture kot sharing, izberi bolj konzervativen odgovor in uskladi tekst v Privacy Policy.

## 4. Ali so podatki sifrirani med prenosom?

Da.

GarageBase uporablja HTTPS povezave za spletno aplikacijo, Supabase in API klice.

## 5. Ali uporabnik lahko zahteva izbris podatkov?

Da.

V aplikaciji:

- Nastavitve -> Izbris racuna

Zunaj aplikacije:

- uporabnik lahko pise na garagebase.app@gmail.com z email naslova racuna.

Priporocen Play Console deletion URL:

```text
https://www.getgaragebase.com/privacy
```

## 6. Data types za Play Console

### Personal info

Izberi:

- Email address
- User IDs

Namen:

- App functionality
- Account management
- Security, fraud prevention, and compliance

Opomba:

- registrska tablica, VIN, lastniski podatki in podobni vnosi so lahko osebni podatki, ce jih uporabnik vnese v aplikacijo.

### Financial info

Premisli / priporoceno konzervativno:

- Other financial info

Zakaj:

- uporabnik lahko vnese zneske goriva, servisov, stroskov in ceno na km.
- aplikacija ne zbira bancnih kartic, bancnih racunov ali placilnih podatkov.

Namen:

- App functionality
- Analytics, ce se agregirano uporablja za izboljsave appa

### Photos and videos

Izberi:

- Photos

Zakaj:

- slike vozil,
- slike racunov,
- slike stevca,
- slike dokumentov/homologacije.

Namen:

- App functionality
- User-generated content

### Files and docs

Izberi, ce Play Console ponudi to kategorijo:

- Files and docs

Zakaj:

- homologacija ali drugi dokumenti so lahko slike/PDF datoteke.

Namen:

- App functionality
- User-generated content

### App activity

Izberi:

- App interactions
- Other user-generated content, ce obrazec to uporabi za vnose in opombe

Zakaj:

- osnovni dogodki uporabe,
- feedback,
- prijave napak,
- vnosi, opisi, opombe.

Namen:

- App functionality
- Analytics
- Developer communications

### App info and performance

Izberi:

- Crash logs
- Diagnostics

Zakaj:

- app lahko belezi tehnicne napake in diagnostiko za admin panel.

Namen:

- Analytics
- Security, fraud prevention, and compliance
- App functionality

### Device or other IDs

Izberi konzervativno:

- Device or other IDs

Zakaj:

- push subscription endpoint in kljuci so tehnicni identifikatorji naprave/brskalnika za obvestila.

Namen:

- App functionality
- Security, fraud prevention, and compliance

## 7. Kategorije, ki jih trenutno ne oznacimo

Ne oznaci, ce se app ne spremeni:

- Location
- Contacts
- Calendar
- Messages
- Audio
- Health and fitness
- Web browsing
- Payment info / credit cards
- Precise device location

Opomba: ce kasneje dodamo koledarsko integracijo, native file permissions, placila, OCR prek zunanjega AI ponudnika ali napredno analitiko, je treba ta dokument, Privacy Policy in Play Console obrazec posodobiti.

## 8. Sensitive permissions

TWA/PWA naj ne zahteva nepotrebnih Android sensitive permissions.

Trenutno naj bodo cilj:

- brez lokacije,
- brez kontaktov,
- brez SMS,
- brez klicev,
- brez `MANAGE_EXTERNAL_STORAGE`,
- kamera/datoteke samo prek uporabnikovega izbora slike ali dokumenta.

## 9. Kratek Play Console opis za privacy

Predlog:

```text
GarageBase collects account information, vehicle records, fuel/service/expense entries, reminders, optional photos/documents, push notification subscription data and diagnostics to provide vehicle record functionality, reports, reminders, security and app improvements. Data is not sold. Users can request account and data deletion in the app settings or by contacting garagebase.app@gmail.com.
```

## 10. Kaj moramo posodobiti kasneje

Posodobi pred javno objavo nove funkcije:

- OCR/AI scan racunov
- placljivi paketi ali Google Play Billing
- Sentry ali dodatni zunanji monitoring
- napredna analitika
- native Android funkcije
- dostop do lokacije, kamere ali datotek na drug nacin kot rocni upload
- deljenje podatkov s partnerji ali kupci vozil zunaj uporabnikovega izrecnega PDF/QR deljenja
