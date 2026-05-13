# GarageBase release checklist

Ta dokument je kratek proces pred vsakim vecjim push/deployem.

## Preden gre na live

1. `npm run prelaunch` preveri smoke test, prevode, osnovne release pogoje in build.
2. Preveri, da admin panel nima novih kriticnih napak.
   - Ce ima lokalni `.env.local` nastavljen `SUPABASE_SERVICE_ROLE_KEY`, lahko zazenes `npm run monitor:errors`.
3. Ce sprememba vsebuje SQL, storage policy, RLS ali brisanje podatkov, najprej odpri `BACKUP_PLAN.md` in izvedi pre-migration checklist.
4. Lokalno ali na staging preveri:
   - prijava/registracija
   - dodaj vozilo
   - dodaj gorivo
   - dodaj servis
   - dodaj strosek
   - PDF report
   - QR scan
   - nastavitve
   - push test, samo admin
5. Ce je sprememba v bazi, najprej zazeni SQL na staging bazi.
   - Za CSV razveljavitev mora biti zagnan `SUPABASE_MIGRACIJA_UVOZ_BATCH_ROLLBACK.sql`.
   - Za admin pakete/uporabnike mora biti zagnan `SUPABASE_MIGRACIJA_ADMIN_UPORABNIKI_PAKETI.sql`.
6. Sele potem deploy na production.

## Po deployu

1. Odpri `getgaragebase.com`.
2. Zaženi `npm run production:check`, da preveriš `getgaragebase.com`, `www.getgaragebase.com` in oba `/api/health` endpointa.
3. Odpri `/api/health` in preveri, da je `ok: true`.
4. Preveri `/login`, `/garaza`, `/nastavitve`, `/admin`.
5. V adminu preveri `Napake v sistemu`.
6. Ce se pojavi vec napak po deployu, naredi rollback v Vercel po postopku v `STAGING_IN_ROLLBACK.md`.
7. Ce so prizadeti uporabniski podatki, ne popravljaj na slepo. Uporabi recovery postopek iz `BACKUP_PLAN.md`.

## Pravilo

Ce popravek ni nujen, najprej staging. Ce je nujen, naredi majhen commit, build, push in takoj preveri admin napake.
