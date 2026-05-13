# GarageBase testni plan za launch in Google Play

Zadnja posodobitev: 13. 5. 2026

Ta dokument je prakticen plan za pripravo GarageBase pred zaprtim testom na Google Play in pred javno objavo. Namen ni samo "ali se app odpre", ampak ali je dovolj stabilna za realne uporabnike, vec naprav in kasnejse posodobitve.

Uradna Google izhodisca:

- Closed testing: https://play.google.com/console/about/closed-testing/
- Set up an open, closed, or internal test: https://support.google.com/googleplay/android-developer/answer/9845334
- App testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465

## 1. Avtomatski testi pred vsakim releaseom

Pred vsakim vecjim push/deployem lokalno zazeni:

```powershell
npm run prelaunch
```

Po deployu na produkcijo zazeni:

```powershell
npm run production:check
```

Ce ima lokalni `.env.local` nastavljen `SUPABASE_SERVICE_ROLE_KEY`, preveri se admin napake:

```powershell
npm run monitor:errors
```

Release ne gre naprej, ce pade build, smoke test, i18n test, production health check ali ce admin panel kaze novo kriticno napako.

## 2. Preden app posljemo testerjem

1. `BACKUP_PLAN.md` mora biti prebran in jasen.
2. Supabase backup mora biti potrjen.
3. Vercel rollback mora biti znan: Deployments -> tri pikice -> Promote to Production.
4. Privacy in Terms morata biti live:
   - https://www.getgaragebase.com/privacy
   - https://www.getgaragebase.com/terms
5. Play Console Data Safety osnutek mora biti usklajen z `GOOGLE_PLAY_DATA_SAFETY.md`.
6. Testni admin racun mora delovati.
7. Testni navadni uporabnik mora delovati.
8. Pred testom ne izvajamo vecjih refactorjev brez konkretnega razloga.

## 3. Google Play closed testing plan

Po trenutnih Google pravilih morajo novi osebni Google Play developer racuni, ustvarjeni po 13. 11. 2023, pred produkcijo izvesti closed test.

Minimalni pogoj za produkcijski dostop:

1. Vsaj 12 testerjev mora biti opt-in v closed test.
2. Ti testerji morajo biti opt-in neprekinjeno zadnjih 14 dni.
3. Tester mora imeti Google racun ali Google Workspace racun.
4. Samo dodajanje emaila v Play Console ni dovolj. Tester mora odpreti opt-in link in se sam pridruziti testu.
5. Po izpolnitvi pogoja se v Play Console odda zahteva za produkcijski dostop.

Prakticno priporocilo:

1. Zberi 15 do 20 testerjev, da ostanemo varni, ce kdo pozabi ali odpade.
2. Uporabi Google Group ali Play Console email listo.
3. Vsakemu poslji navodila iz `GOOGLE_PLAY_TESTER_NAVODILA.md`.
4. Vodi seznam, kdo je:
   - dobil link,
   - kliknil opt-in,
   - namestil app,
   - poslal feedback,
   - ostal v testu do 14. dne.
5. Ne racunaj dneva 14 kot avtomatski launch. Po 14 dneh Google se vedno pregleda zahtevo za produkcijski dostop.

## 4. Kdo naj bo tester

Potrebujemo mesanico ljudi, ne samo en tip telefona.

Priporocena skupina:

1. 3 do 5 ljudi, ki znajo jasno prijaviti napako.
2. 3 do 5 navadnih uporabnikov, ki ne poznajo projekta.
3. 2 do 3 uporabniki starejsih Android naprav.
4. 2 do 3 uporabniki novejsih Android naprav.
5. Vsaj 1 uporabnik, ki uporablja temni nacin.
6. Vsaj 1 uporabnik, ki uporablja svetli nacin.
7. Vsaj 1 uporabnik, ki bo testiral lite nacin.

Priporocena pokritost naprav:

1. Android 8 ali 9, ce ga lahko dobimo.
2. Android 10 do 12.
3. Android 13 do 16.
4. Samsung.
5. Xiaomi/Redmi/Poco.
6. Pixel ali OnePlus, ce je na voljo.

## 5. Rocni smoke test za vsakega testerja

Vsak tester naj naredi vsaj to:

1. Namesti app iz Google Play test linka.
2. Odpre app.
3. Ustvari racun ali se prijavi.
4. Preveri, da se lahko vrne v app brez ponovne registracije.
5. Doda vozilo.
6. Doda ali zamenja sliko vozila.
7. Preklopi med vozili v garazi.
8. Doda tankanje.
9. Izbere `Poln rezervar` ali `Delno tankanje`.
10. Doda servis.
11. Doda drug strosek.
12. Odpre stran Stroski in preveri grafe ter kartice.
13. Odpre Dashboard in preveri, da vozilo in podatki ustrezajo izbranemu vozilu.
14. Odpre zgodovino goriva.
15. Odpre zgodovino servisa.
16. Doda opomnik.
17. Preveri push obvestila, ce jih telefon dovoli.
18. Odpre PDF report.
19. Preklopi svetli/temni nacin.
20. Preklopi lite nacin.
21. Preveri Privacy in Terms linke.

## 6. Napake, ki jih aktivno lovimo

To so stvari, ki so za GarageBase posebej pomembne:

1. Garaza se nalozi samo napol ali slike ostanejo sive.
2. Kliknes eno vozilo, podatki ostanejo od drugega.
3. Aktivna in arhivirana vozila se mesajo.
4. Stroski obstajajo, kartice pa kazejo 0.
5. Poraba ali EUR/km sta ocitno nelogicna.
6. Delno tankanje vpliva na porabo, ko ne bi smelo.
7. App lock zaklene uporabnika brez izhoda.
8. Push obvestilo odpre napacno stran.
9. PDF report ne razlikuje jasno GarageBase vnosov in uvoza.
10. Mobilni layout ima prevelike gumbe, prekrivanje ali neberljive oznake.
11. Slovenski in angleski tekst nista usklajena.
12. Uporabnik vidi admin funkcijo, ce ni admin.
13. Uporabnik lahko ureja nekaj, kar bi moralo biti zaklenjeno.
14. App deluje samo po rocnem refreshu.

## 7. Bug report template

Tester naj napako prijavi v tem formatu:

```text
Naprava:
Android verzija:
GarageBase verzija/build:
Ali je bilo v app ali v brskalniku:
Cas napake:
Kaj sem kliknil:
Kaj sem pricakoval:
Kaj se je zgodilo:
Ali se ponovi:
Screenshot/video:
```

Za kriticne napake naj tester napise se:

```text
Ali je prislo do izgube podatkov:
Email racuna, ce ga lahko deli:
Katero vozilo je bilo izbrano:
```

## 8. Kriteriji za "lahko gremo naprej"

Za closed testing:

1. App se namesti iz Play test linka.
2. Login in registracija delujeta.
3. Vozila, tankanja, servisi in stroski se shranijo.
4. Podatki se ne mesajo med vozili.
5. Stran Stroski prikaze pravilne vsote, ko podatki obstajajo.
6. Garaza se nalozi brez rocnega refresh trika pri vecini naprav.
7. App se ne zaklene uporabniku brez moznosti odklepa.
8. Admin panel ni viden navadnim uporabnikom.
9. Privacy, Terms in Data Safety so usklajeni.
10. Ni znane napake, ki lahko brise ali zamenja podatke uporabnika.

Za produkcijo:

1. Vsaj 12 testerjev je opt-in 14 dni neprekinjeno, ce Play Console to zahteva.
2. Kriticne napake iz closed testa so popravljene.
3. `npm run prelaunch` je zelen.
4. `npm run production:check` je zelen.
5. Admin panel ne kaze kriticnih napak.
6. Zadnji dober commit in Vercel deploy sta zapisana.
7. Backup/recovery pot je pripravljena.

## 9. Predlagan 14-dnevni ritem

Dan 0:

- notranji smoke test,
- build,
- produkcijski health check,
- priprava Play Console closed testa.

Dan 1:

- poslji opt-in link testerjem,
- preveri, kdo se je dejansko pridruzil,
- ne stej samo dodanih emailov.

Dan 2 do 5:

- testerji naredijo osnovni smoke test,
- zbiramo screenshote in naprave,
- popravljamo kriticne napake z majhnimi commiti.

Dan 6 do 10:

- ponovimo teste na popravljenih buildih,
- posebej preverimo garazo, stroske, tankanja, report, app lock in push.

Dan 11 do 14:

- ne dodajamo velikih funkcij,
- samo stabilizacija,
- priprava odgovorov za Play Console production access.

Dan 15 ali kasneje:

- ce so pogoji izpolnjeni, oddamo zahtevo za produkcijski dostop,
- po odobritvi naredimo postopni rollout.

## 10. Cesa testerji ne smejo delati

1. Naj ne uporabljajo GarageBase kot edine kopije pomembnih dokumentov v beta fazi.
2. Naj ne testirajo izbrisa racuna na svojem glavnem racunu, razen ce vedo, da bodo podatki izbrisani.
3. Naj ne nalagajo obcutljivih dokumentov, ce ni nujno za test.
4. Naj ne delijo closed testing linka javno.
5. Naj ne delajo SQL, admin ali produkcijskih posegov.

## 11. Po closed testingu

Pred produkcijo naredimo:

1. pregled vseh feedbackov,
2. seznam kriticnih, visokih in srednjih napak,
3. popravek kriticnih napak,
4. ponoven `npm run prelaunch`,
5. ponoven `npm run production:check`,
6. preverjanje Play Console Data Safety,
7. preverjanje Privacy/Terms,
8. odlocitev za staged rollout, najprej majhen odstotek uporabnikov, ce Play Console to omogoca.

## 12. Opombe za prihodnje funkcije

Vsaka nova vecja funkcija po launchu naj gre najprej v test track:

1. nova verzija v internal testing,
2. kratek test z adminom,
3. closed/open test za vecje spremembe,
4. sele potem produkcija.

To posebej velja za:

1. OCR/scan racunov,
2. placljive pakete,
3. uvoz vecjih CSV zgodovin,
4. spremembe izracunov porabe/stroskov,
5. spremembe brisanja ali prenosa podatkov,
6. native Android permission spremembe.
