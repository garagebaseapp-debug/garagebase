# GarageBase backup plan

Backup ni isto kot git. Git varuje kodo, ne varuje pa uporabniskih podatkov v Supabase.

## Kaj moramo varovati

1. Supabase baza:
   - uporabniki
   - vozila
   - servisi
   - gorivo
   - stroski
   - opomniki
   - QR prenosi
   - admin napake
2. Supabase Storage:
   - slike vozil
   - slike racunov
   - slike stevca
   - homologacija
3. GitHub:
   - koda
   - SQL migracije
   - dokumentacija

## Minimalno pred lansiranjem

1. V Supabase preveri, ali ima projekt vklopljene avtomatske backup-e.
2. Enkrat tedensko izvozi SQL dump ali uporabi Supabase backup funkcijo.
3. Za storage slike preveri, kako jih lahko izvoziš ali migriras.
4. Pred vecjo migracijo baze najprej naredi rocen backup.

## Pravilo pred nevarnimi spremembami

Pred SQL migracijo, ki spreminja ali brise podatke:

1. backup baze
2. test na staging bazi
3. sele potem production

## Kaj se ne sme

- Ne brisemo stolpcev v produkciji brez backupa.
- Ne spreminjamo RLS pravil na hitro brez testa.
- Ne pustimo service role kljuca v kodi. Service role kljuc je samo v Vercel Environment Variables.

## Strosek

Na zacetku je backup lahko vkljucen v Supabase plan ali omejen glede na paket. Ko bo vec uporabnikov in slik, bo treba racunati tudi storage in backup retention.
