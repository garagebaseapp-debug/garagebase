# GarageBase release checklist

Ta dokument je kratek proces pred vsakim vecjim push/deployem.

## Preden gre na live

1. `npm run check`
2. Preveri, da admin panel nima novih kriticnih napak.
3. Lokalno ali na staging preveri:
   - prijava/registracija
   - dodaj vozilo
   - dodaj gorivo
   - dodaj servis
   - dodaj strosek
   - PDF report
   - QR scan
   - nastavitve
   - push test, samo admin
4. Ce je sprememba v bazi, najprej zaženi SQL na staging bazi.
5. Sele potem deploy na production.

## Po deployu

1. Odpri `getgaragebase.com`.
2. Preveri `/login`, `/garaza`, `/nastavitve`, `/admin`.
3. V adminu preveri `Napake v sistemu`.
4. Ce se pojavi vec napak po deployu, naredi rollback v Vercel.

## Pravilo

Ce popravek ni nujen, najprej staging. Ce je nujen, naredi majhen commit, build, push in takoj preveri admin napake.
