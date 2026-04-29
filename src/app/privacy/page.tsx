export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080810] text-white px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-[#a09aff] text-sm font-semibold">Nazaj na GarageBase</a>
        <h1 className="mt-6 text-4xl font-black">Politika zasebnosti</h1>
        <p className="mt-3 text-[#8a8aa8]">Zadnja posodobitev: 29. 4. 2026</p>

        <section className="mt-8 space-y-5 text-[#d8d8e8] leading-relaxed">
          <p>
            GarageBase je aplikacija za vodenje evidence vozil, servisov, stroskov, opomnikov, PDF porocil in QR prenosa zgodovine. Ta dokument je osnovni osnutek politike zasebnosti in ga je pred vecjim javnim lansiranjem priporoceno pregledati s pravnikom.
          </p>

          <h2 className="text-2xl font-bold text-white">Katere podatke obdelujemo</h2>
          <p>Obdelujemo lahko email naslov, podatke o vozilih, registrsko tablico, VIN stevilko, kilometre, servisne vnose, stroske, opomnike, slike vozil, slike racunov, push subscription podatke, nastavitve aplikacije, feedback, osnovno analitiko uporabe in tehnicne napake.</p>

          <h2 className="text-2xl font-bold text-white">Zakaj podatke uporabljamo</h2>
          <p>Podatke uporabljamo za delovanje uporabniskega racuna, prikaz garaze, shranjevanje zgodovine vozila, pripravo PDF porocil, QR prenos zgodovine, opomnike, izboljsavo aplikacije, varnost in odpravljanje napak.</p>

          <h2 className="text-2xl font-bold text-white">Slike racunov in dokazila</h2>
          <p>Slike racunov in vozil lahko vsebujejo osebne ali poslovne podatke. Uporabnik naj nalaga samo slike, za katere ima pravico shranjevanja. GarageBase lahko zaradi varnosti, stroskov ali zlorab omeji velikost, stevilo ali trajanje hrambe slik.</p>

          <h2 className="text-2xl font-bold text-white">AI/OCR branje racunov</h2>
          <p>AI/OCR branje racunov je trenutno v internem testiranju in ni javno vklopljeno za beta uporabnike. Javna funkcija je planirana za leto 2027. Rocni vnos in shranjevanje slike racuna sta loceni funkciji.</p>

          <h2 className="text-2xl font-bold text-white">Analitika in napake</h2>
          <p>Za izboljsavo aplikacije lahko beležimo osnovne dogodke, kot so obisk strani, klik funkcije, izbrani nacin prikaza, tema, jezik in napake. Te podatke uporabljamo za razvoj, varnost in odlocanje o paketih.</p>

          <h2 className="text-2xl font-bold text-white">QR in prenos zgodovine</h2>
          <p>Ko uporabnik ustvari QR ali PDF porocilo, se lahko v porocilo vkljucijo podatki vozila in izbrani zgodovinski zapisi. Uporabnik sam izbere, katere vsebine vkljuci v porocilo. GarageBase ne potrjuje absolutne resnice podatkov za nazaj, ampak pomaga prikazati sledljivo zgodovino od trenutka uporabe aplikacije naprej.</p>

          <h2 className="text-2xl font-bold text-white">Pravice uporabnika</h2>
          <p>Uporabnik lahko zahteva dostop do podatkov, popravek, izvoz, omejitev obdelave ali izbris podatkov, kjer je to zakonsko in tehnicno izvedljivo. Za zahteve pisi na garagebase.app@gmail.com.</p>

          <h2 className="text-2xl font-bold text-white">Hramba podatkov</h2>
          <p>Podatke hranimo toliko casa, kolikor je potrebno za uporabo aplikacije, varnost, backup in zakonske obveznosti. Uporabnik lahko vozilo arhivira, izvozi podatke ali zahteva izbris racuna.</p>

          <h2 className="text-2xl font-bold text-white">Kontakt</h2>
          <p>Za vprasanja glede zasebnosti pisi na garagebase.app@gmail.com.</p>
        </section>
      </div>
    </main>
  )
}
