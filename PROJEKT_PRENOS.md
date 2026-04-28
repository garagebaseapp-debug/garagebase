# GarageBase - dokument za selitev projekta

Zadnja posodobitev: 28. 04. 2026

Ta dokument je namenjen temu, da lahko projekt GarageBase kasneje preneseš na drug računalnik, drug hosting ali drug račun. Namenoma NE vsebuje gesel, tokenov ali privatnih ključev. Dejanske skrivnosti shrani v password manager, npr. Bitwarden, 1Password, iCloud Keychain ali Google Password Manager.

## Glavni računi in dostopi

### GitHub
- Uporabnik/organizacija: `garagebaseapp-debug`
- Repo: `garagebase`
- Varen repo URL: `https://github.com/garagebaseapp-debug/garagebase.git`
- Pomembno: trenutni Git remote je imel osebni GitHub token v URL-ju. Ta token je treba rotirati oziroma izbrisati v GitHub nastavitvah in remote nastaviti brez tokena.
- Priporočen ukaz za varen remote:

```bash
git remote set-url origin https://github.com/garagebaseapp-debug/garagebase.git
```

### Vercel
- Projekt: `garagebase`
- Produkcijska domena: `https://getgaragebase.com`
- Cron route: `/api/cron`
- Cron schedule v `vercel.json`: `0 6 * * *`
- Opomba: `0 6 * * *` pomeni ob 06:00 UTC, kar je v Sloveniji običajno 07:00 pozimi ali 08:00 poleti.

### Supabase
- Projekt: GarageBase / Supabase projekt za aplikacijo
- Uporablja se za prijavo, vozila, gorivo, servise, stroške, opomnike in push subscriptions.
- V aplikaciji se uporablja klient v `src/lib/supabase.ts`.

### Email / kontakt
- Kontakt na strani: `garagebase.app@gmail.com`
- VAPID email za push obvestila: shrani dejansko vrednost v password manager.

## Environment variables

Te vrednosti morajo biti nastavljene lokalno v `.env.local` in v Vercel Environment Variables. Dejanske vrednosti ne shranjuj v GitHub.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
VAPID_EMAIL=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
CRON_SECRET=...
```

Opombe:
- `NEXT_PUBLIC_SUPABASE_URL` in `NEXT_PUBLIC_SUPABASE_ANON_KEY` sta javni vrednosti za frontend, ampak ju vseeno vodi urejeno.
- `VAPID_PRIVATE_KEY` je skrivnost. Ne pošiljaj ga nikomur in ne commitaj v GitHub.
- `CRON_SECRET` je skrivnost za ročni klic cron route. Vercel cron sicer pošlje svoj user-agent, ampak secret naj ostane nastavljen.

## Lokalni zagon projekta

1. Namesti Node.js.
2. Kloniraj repo:

```bash
git clone https://github.com/garagebaseapp-debug/garagebase.git
cd garagebase
```

3. Namesti pakete:

```bash
npm install
```

4. Ustvari `.env.local` in vanj vpiši environment variables.
5. Zaženi lokalno:

```bash
npm run dev
```

6. Odpri:

```text
http://localhost:3000
```

## Build preverjanje

Pred pushom preveri:

```bash
npm run build
```

Če build uspe, lahko narediš:

```bash
git add .
git commit -m "opis spremembe"
git push
```

## Pomembne datoteke

- `src/app/page.tsx` - prva predstavitvena stran
- `src/app/garaza/page.tsx` - garaža / seznam vozil
- `src/app/dashboard/page.tsx` - detail vozila
- `src/app/nastavitve/page.tsx` - nastavitve aplikacije
- `src/app/layout.tsx` - globalni layout, PWA/meta in nastavitev pisave/teme
- `src/app/api/cron/route.ts` - dnevno preverjanje opomnikov
- `src/app/api/push/route.ts` - testno / ročno pošiljanje push obvestil
- `src/lib/supabase.ts` - Supabase povezava
- `public/sw.js` - service worker za PWA/push
- `public/manifest.json` - PWA manifest
- `vercel.json` - Vercel cron nastavitev

## Kaj mora biti shranjeno v password managerju

Ustvari zapis z imenom `GarageBase - dostopi` in dodaj:

- GitHub uporabnik
- GitHub geslo ali passkey info
- GitHub Personal Access Token, če ga še uporabljaš
- Vercel login email
- Vercel geslo/passkey info
- Supabase login email
- Supabase geslo/passkey info
- Supabase project URL
- Supabase anon key
- VAPID public key
- VAPID private key
- VAPID email
- CRON_SECRET
- Email račun `garagebase.app@gmail.com` in njegov dostop
- Domeno `getgaragebase.com`: registrar, login email, geslo/passkey info

## Varnostni opomniki

- Nikoli ne commitaj `.env.local`.
- Nikoli ne pošiljaj `VAPID_PRIVATE_KEY`, `CRON_SECRET` ali GitHub tokena po chatu.
- Če se token pojavi v terminalu, screenshotu ali dokumentu, ga raje rotiraj.
- Če projekt seliš na drug računalnik, kopiraj repo + nastavi `.env.local` iz password managerja.
- Če projekt seliš na drug Vercel račun, najprej nastavi vse environment variables, šele potem deploy.

## Stanje funkcij po trenutnem delu

Končano:
- ločen desktop/mobile prikaz
- nova landing stran z novo sliko
- nastavljiva velikost pisave v app
- grid nastavitve za web
- osnovna push obvestila
- detail pogled vozila in večje ikone so že bili urejeni

Še odprto:
- lep svetli način
- logo pri push obvestilih
- izvoz/opomniki v koledar
- odklep s prstnim odtisom
- pravi SLO/ANG prevodi
- QR prenos zgodovine na novega lastnika
- dodatna polja lastnikov/VIN in dodelano poročilo
