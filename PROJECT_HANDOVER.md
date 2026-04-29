# GarageBase - projektni handover

Ta dokument je namenjen selitvi projekta, predaji drugemu developerju ali obnovi projekta, ce gre kaj narobe.

Pomembno: v ta dokument ne vpisuj dejanskih gesel, private keyev ali secretov. Dejanske vrednosti shrani v password manager, npr. Bitwarden, 1Password ali Google Password Manager.

## 1. Glavni dostopi

Shrani dostop do teh racunov:

- GitHub racun in repo: `garagebase`
- Vercel racun in projekt: `garagebase`
- Supabase racun in projekt: GarageBase baza
- Domena: `getgaragebase.com`
- Email: `garagebase.app@gmail.com`
- Google Play Console racun, ko bo Android app objavljena

## 2. Environment variables

Te vrednosti morajo biti nastavljene lokalno v `.env.local` in na Vercel projektu.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
  - Kje najdes: Supabase Project Settings -> API
  - Namen: URL Supabase projekta.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Kje najdes: Supabase Project Settings -> API
  - Namen: javni anon key za client app.

- `SUPABASE_SERVICE_ROLE_KEY`
  - Kje najdes: Supabase Project Settings -> API
  - Namen: samo za server-side admin opravila.
  - Pozor: nikoli ga ne uporabljaj v client kodi in nikoli ga ne objavi v GitHub.

- `SUPABASE_DB_PASSWORD`
  - Kje najdes: Supabase Database settings.
  - Namen: direktni dostop do baze, backup, migracije.

### Push obvestila

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - Namen: javni kljuc za browser push.

- `VAPID_PRIVATE_KEY`
  - Namen: zasebni kljuc za posiljanje push obvestil.
  - Pozor: secret, samo Vercel env/server.

- `VAPID_EMAIL`
  - Namen: email za VAPID konfiguracijo.

### Cron

- `CRON_SECRET`
  - Namen: zascita `/api/cron` endpointa.
  - Pozor: naj bo dolg nakljucen string.

## 3. Kje so glavne funkcije v kodi

- Landing stran: `src/app/page.tsx`
- Login: `src/app/login/page.tsx`
- Garaza: `src/app/garaza/page.tsx`
- Nastavitve: `src/app/nastavitve/page.tsx`
- Nastavitve avta: `src/app/nastavitve-avta/page.tsx`
- Vnos goriva: `src/app/vnos-goriva/page.tsx`
- Vnos servisa: `src/app/vnos-servisa/page.tsx`
- Vnos stroska: `src/app/vnos-stroska/page.tsx`
- PDF report: `src/app/report/page.tsx`
- QR scan/import: `src/app/scan/page.tsx`
- CSV uvoz: `src/app/uvoz-podatkov/page.tsx`
- Admin panel: `src/app/admin/page.tsx`
- Feedback admin: `src/app/admin-feedback/page.tsx`
- Push API: `src/app/api/push/route.ts`
- Cron API: `src/app/api/cron/route.ts`
- Supabase client: `src/lib/supabase.ts`
- Prevodi: `src/lib/i18n.tsx`
- Analytics: `src/lib/analytics.ts`
- QR prenos helper: `src/lib/transfer.ts`
- OCR helper: `src/lib/receipt-ocr.ts`

## 4. SQL migracije

Te datoteke je treba zagnati v Supabase SQL Editorju, ce se projekt seli na novo bazo:

- `SUPABASE_MIGRACIJA_PRENOS.sql`
- `SUPABASE_MIGRACIJA_QR_PRENOS.sql`
- `SUPABASE_MIGRACIJA_RACUNI.sql`
- `SUPABASE_MIGRACIJA_FEEDBACK.sql`
- `SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql`
- `SUPABASE_MIGRACIJA_HOMOLOGACIJA.sql`
- `SUPABASE_MIGRACIJA_ZAUPANJE_PRENOS.sql`
- `SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql`

Priporocilo: ob vecjem lansiranju naredi eno zdruzeno migracijo ali urejen migracijski sistem.

## 5. Lokalni zagon projekta

```bash
npm install
npm run dev
```

Lokalni URL:

```text
http://localhost:3000
```

Build preverjanje:

```bash
npm run build
```

## 6. Deploy

Glavni deploy poteka prek GitHub -> Vercel.

Obicajen postopek:

```bash
git add .
git commit -m "opis spremembe"
git push
```

Vercel potem sam naredi deployment iz branch `main`.

## 7. Backup

Pred vecjim marketingom uredi:

- dnevni backup Supabase baze
- test restore baze
- backup Supabase storage slik
- kopijo `.env.local` vrednosti v password managerju
- zapis vseh domen in DNS nastavitev

Minimalni mesecni ritual:

1. Export baze iz Supabase.
2. Preveri, da se backup lahko odpre.
3. Preveri Vercel env variables.
4. Preveri GitHub repo.
5. Preveri, da zadnji deploy dela.

## 8. Pred javnim lansiranjem

Nujno urediti:

- Privacy Policy
- Terms of Use
- Launch promo pogoji do 31. 12. 2026
- checkbox pri registraciji za pogoje
- izbris racuna/podatkov
- izvoz podatkov uporabnika
- zasebnost slik racunov
- QR expiry in revoke
- rate limit za API endpoint-e
- `/api/push` zascita
- `/api/cron` samo prek `CRON_SECRET`
- admin monitoring napak

## 9. AI/OCR status

AI/OCR branje racunov je trenutno zaklenjeno za javne beta uporabnike.

Trenutno ga lahko testirajo:

- `drazen.letsgo@gmail.com`
- `drazenletsgo@gmail.com`
- `garagebase.app@gmail.com`
- uporabniki v tabeli `admin_users`

Javna komunikacija:

```text
AI scan racunov je v internem testiranju in je planiran za lansiranje v letu 2027.
```

## 10. Google Play priprava

Pred objavo Android aplikacije bos potreboval:

- Google Play Console developer account
- app package name
- app icon
- privacy policy URL
- data safety obrazec
- screenshots
- opis aplikacije
- support email
- produkcijski build APK/AAB

Ce bodo digitalni paketi kupljeni v Android aplikaciji, preveri Google Play Billing pravila.

## 11. Racunovodstvo in pravno

Pred prvim zaracunavanjem preveri:

- ali odpres popoldanski s.p., polni s.p. ali d.o.o.
- kako izdajati racune
- DDV status
- kako voditi stroske serverjev
- pogoje uporabe
- GDPR obveznosti

Priporoceno:

- 1 posvet z racunovodjo pred placljivimi paketi
- 1 pravni pregled Privacy Policy in Terms pred vecjim marketingom

## 12. Najvecja tveganja

- preveliki stroski slik in AI/OCR
- javni storage linki do racunov
- premalo zasciteni API endpointi
- QR kode brez roka veljavnosti
- brez privacy/terms dokumentov
- brez backup/restore testa
- prevec uporabnikov brez fair-use omejitev

## 13. Fair-use ideja za beta

Predlog teksta:

```text
V obdobju lansiranja so funkcije GarageBase odklenjene brez doplacila do 31. 12. 2026, v okviru postene uporabe. GarageBase lahko zaradi varnosti, zlorab ali izjemno visoke porabe uvede tehnicne omejitve. O morebitnih paketih in cenah bomo uporabnike obvestili vnaprej.
```

