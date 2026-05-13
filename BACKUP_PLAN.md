# GarageBase backup in recovery plan

Ta dokument je prakticen runbook za primer, da se pokvari web/app, deploy, SQL migracija ali uporabniski podatki. Git varuje kodo, ne varuje pa Supabase baze in slik.

## 1. Kaj moramo varovati

### Koda in konfiguracija

- GitHub repo `garagebase`
- Vercel projekt `garagebase`
- Environment variables v Vercel in lokalnem `.env.local`
- SQL migracije v repoju
- PWA/Android asseti v `public/`

### Supabase baza

Najbolj kriticne tabele:

- `auth.users`
- `public.cars`
- `public.fuel_logs`
- `public.service_logs`
- `public.expenses`
- `public.reminders`
- `public.push_subscriptions`
- `public.user_plans`
- `public.admin_users`
- `public.vehicle_transfers`
- `public.bug_reports`
- `public.feedback`
- `public.app_errors`

### Supabase Storage

Kriticni bucketi:

- `car-images`
- `service-documents`

Ti bucketi vsebujejo slike vozil, racune, slike stevca in homologacijo.

## 2. Cilj pred Google Play launchom

Minimalen cilj:

- baza se lahko obnovi na stanje pred napacnim deployem ali SQL migracijo,
- slike uporabnikov se ne izgubijo,
- app se lahko hitro vrne na zadnji delujoc Vercel deploy,
- vemo, kateri commit in kateri deploy sta zadnja dobra verzija.

Priporocen cilj:

- dnevni avtomatski backup baze,
- rocni backup pred vsako vecjo migracijo,
- vsaj en test restore na loceni/staging bazi,
- mesecni export storage bucketov ali potrjen Supabase storage backup postopek,
- zapis dostopov v password managerju.

## 3. Pravila, ki jih ne krsimo

1. Nikoli ne brisemo stolpcev, tabel ali storage bucketov v produkciji brez backupa.
2. Nikoli ne popravljamo pokvarjene produkcije na slepo, ce lahko najprej naredimo Vercel rollback.
3. Nikoli ne commitamo `.env.local`, service role keya, VAPID private keya ali `CRON_SECRET`.
4. Nikoli ne uporabljamo `git reset --hard` ali podobnih ukazov za rollback produkcije brez jasnega dogovora.
5. Vsaka migracija, ki spreminja podatke, mora imeti vsaj rollback strategijo ali jasen export pred izvedbo.

## 4. Pred vsako SQL migracijo

Preden zazenes SQL v Supabase production SQL Editorju:

1. Preberi cel SQL od zacetka do konca.
2. Preveri, ali vsebuje `drop`, `delete`, `truncate`, `update` brez `where`, spremembo RLS ali spremembo storage policy.
3. Ce je migracija samo `add column if not exists`, `create index if not exists` ali `create policy` z jasnim imenom, je nizko tveganje.
4. Ce migracija spreminja ali brise podatke, najprej naredi backup baze.
5. Po migraciji preveri `npm run production:check`.
6. Odpri glavne strani: `/garaza`, `/dashboard`, `/vnos-goriva`, `/stroski`, `/admin`.

## 5. Pred vsakim vecjim deployem

Izvedi:

```powershell
npm run prelaunch
```

Po deployu:

```powershell
npm run production:check
```

Ce imas lokalno nastavljen `SUPABASE_SERVICE_ROLE_KEY`, preveri se napake:

```powershell
npm run monitor:errors
```

## 6. Rollback kode, ce se app pokvari

To je najhitrejsa pot, ce je problem v frontend/API kodi.

1. Pojdi v Vercel -> GarageBase -> Deployments.
2. Najdi zadnji deploy, ki je delal.
3. Klikni tri pikice.
4. Izberi `Promote to Production`.
5. Pocakaj, da alias `getgaragebase.com` kaze na stari delujoci deploy.
6. Zazeni:

```powershell
npm run production:check
```

7. V GitHubu pusti zadnji slab commit pri miru, dokler ne naredimo popravek ali revert commit.

Pomembno: Vercel rollback vrne kodo, ne vrne baze. Ce je SQL migracija pokvarila podatke, rabis poglavje 7.

## 7. Recovery baze, ce SQL pokvari podatke

Ce migracija ali bug pokvari uporabniske podatke:

1. Takoj ustavi nadaljnje spremembe.
2. Ne izvajaj dodatnih SQL popravkov na pamet.
3. Zapisi:
   - cas napake,
   - zadnji commit,
   - Vercel deployment URL,
   - SQL, ki je bil izveden,
   - katere tabele so prizadete.
4. Ce je problem samo v kodi, naredi Vercel rollback.
5. Ce so podatki spremenjeni, uporabi Supabase backup/restore ali rocni export pred migracijo.
6. Restore najprej testiraj na loceni/staging bazi, ce je mogoce.
7. Sele potem popravi produkcijo.

### Hitri read-only pregled po incidentu

V Supabase SQL Editorju lahko varno pogledas stevilo zapisov:

```sql
select 'cars' as table_name, count(*) from public.cars
union all select 'fuel_logs', count(*) from public.fuel_logs
union all select 'service_logs', count(*) from public.service_logs
union all select 'expenses', count(*) from public.expenses
union all select 'reminders', count(*) from public.reminders
union all select 'push_subscriptions', count(*) from public.push_subscriptions;
```

To nic ne spreminja. Namen je samo hitro preveriti, ali je kaj ocitno izginilo.

## 8. Recovery slik in dokumentov

Ce slike vozil ali racunov izginejo:

1. Najprej preveri, ali so zapisi v bazi se vedno prisotni (`slika_url`, `racun_url`, dokument URL).
2. Preveri bucket v Supabase Storage:
   - `car-images`
   - `service-documents`
3. Ce so datoteke v storageu, je verjetno problem v URL, cacheu, policy ali kodi.
4. Ce datotek ni, potrebujemo storage backup ali export.
5. Ne brisi bucketov in ne spreminjaj public/private nastavitev brez testa.

## 9. Recovery uporabnika

Ce en uporabnik javi izgubo podatkov:

1. Najprej preveri, ali je prijavljen z istim emailom.
2. V admin panelu preveri uporabnika in stevilo vozil.
3. V Supabase preveri `cars.user_id`.
4. Ne premikaj vrstic med uporabniki brez pisne potrditve uporabnika.
5. Ce je slo za brisanje racuna, podatkov ne obljubljaj nazaj, dokler ni jasno, ali backup vsebuje stanje pred izbrisom.

## 10. RPO in RTO

Pred javnim lansiranjem ciljamo:

- RPO za bazo: najvec 24 ur izgube podatkov v najslabsem primeru.
- RTO za app kodo: 15 do 30 minut, ker Vercel rollback je hiter.
- RTO za bazo: odvisno od Supabase plana in velikosti baze; cilj je isti dan.
- RTO za storage: odvisno od backup/export postopka; zato je storage backup treba testirati pred vecjim marketingom.

RPO pomeni, koliko podatkov lahko izgubimo. RTO pomeni, kako hitro lahko app spravimo nazaj.

## 11. Mesecni ritual

Enkrat na mesec:

1. Preveri Supabase backup nastavitev.
2. Preveri, da imas dostop do GitHub, Vercel, Supabase, domene in emaila.
3. Zazeni `npm run production:check`.
4. Preveri Vercel env variables.
5. Preveri admin napake.
6. Exportaj ali preveri backup za storage slike.
7. Zapisi zadnji znan dober commit in Vercel deployment.

## 12. Pred Google Play closed testing

Preden gre app med testerje:

1. Dnevni backup baze mora biti potrjen.
2. Znana mora biti pot za Vercel rollback.
3. Znana mora biti pot za Supabase restore.
4. Admin mora imeti dostop do `npm run production:check`.
5. Privacy/Terms morata jasno razloziti hrambo in brisanje podatkov.
6. Testerjem ne obljubljamo, da so beta podatki poslovno kriticni, dokler restore ni testiran.

## 13. Kaj se shrani v password manager

Zapis `GarageBase - dostopi` naj vsebuje:

- GitHub login/passkey info
- Vercel login/passkey info
- Supabase login/passkey info
- domena `getgaragebase.com` registrar dostop
- email `garagebase.app@gmail.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`
- `CRON_SECRET`
- Google Play Console dostop, ko bo ustvarjen

## 14. Trenutno odprto pred launchom

- Potrditi Supabase backup plan in retention.
- Testirati en restore na staging/loceni bazi.
- Doreci storage backup/export za `car-images` in `service-documents`.
- Uvesti ali potrditi Sentry/error monitoring za runtime napake.
- Doreci, kdo ima admin dostop in kdo lahko izvaja SQL v produkciji.
