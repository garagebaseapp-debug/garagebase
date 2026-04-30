# Staging in rollback

## Cilj

Ne popravljamo vecjih stvari direktno na produkciji, ko bo app zunaj. Najprej testna verzija, potem live.

## Predlagana postavitev

- Production: `main` veja -> `getgaragebase.com`
- Staging: `staging` veja -> testna Vercel domena, npr. `garagebase-staging.vercel.app`

## Kako naredis staging v Vercel

1. V GitHubu naredi vejo `staging`.
2. V Vercel projektu pojdi na `Settings -> Git`.
3. Pusti Production Branch = `main`.
4. Vsak push na `staging` bo Preview/Staging deploy.
5. V staging deploy dodaj iste env variable kot production, lahko pa kasneje uporabiva loceno Supabase test bazo.

## Kako delava popravke

1. Bug popravek gre v locen commit.
2. Najprej push na `staging`.
3. Test na staging URL.
4. Ce deluje, merge/push na `main`.

## Rollback v Vercel

Ce live deploy pokvari app:

1. Vercel -> projekt GarageBase.
2. Odpri `Deployments`.
3. Izberi zadnji deploy, ki je prej delal.
4. Klikni tri pikice.
5. Klikni `Promote to Production` ali `Redeploy` na dobrem deployu.
6. V admin panelu preveri, da se nove napake nehajo pojavljati.

## Pravilo za paniko

Ce je app po deployu pokvarjen za uporabnike, se ne popravlja na slepo. Najprej rollback, potem mirno popravljanje na staging.
