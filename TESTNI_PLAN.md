# GarageBase testni plan

To so osnovni testi, ki jih mora app zdrzati pred vecjim lansiranjem.

## Avtomatsko

```bash
npm run check
```

Trenutno to preveri:

- kriticne route/datoteke obstajajo
- Next build se uspesno sestavi

## Rocni smoke test

1. Registracija ali prijava deluje.
2. Dodaj vozilo po korakih.
3. Vozilo je vidno v garazi.
4. Dodaj tankanje.
5. Dodaj servis.
6. Dodaj dodaten strosek.
7. Odpri stroske in preveri, da se podatki prikazejo.
8. Odpri report in prenesi PDF.
9. Preveri QR scan.
10. Nastavitve:
    - jezik SLO/ANG
    - dark/light
    - prikaz garaze
    - obvestila
11. Admin:
    - statistika se odpre
    - napake se prikazejo
    - feedback se prikaze

## Pred javnim lansiranjem dodamo se

- pravi end-to-end test z browserjem za login in osnovne vnose
- test PDF generiranja
- test QR uvoza
- test push subscribe flowa

Za zacetek je najpomembnejse, da vsak vecji deploy ne gre mimo `npm run check` in rocnega smoke testa.
