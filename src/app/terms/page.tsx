export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#080810] text-white px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-[#a09aff] text-sm font-semibold">Nazaj na GarageBase</a>
        <h1 className="mt-6 text-4xl font-black">Pogoji uporabe</h1>
        <p className="mt-3 text-[#8a8aa8]">Zadnja posodobitev: 29. 4. 2026</p>

        <section className="mt-8 space-y-5 text-[#d8d8e8] leading-relaxed">
          <p>
            Ti pogoji so osnovni osnutek za GarageBase in jih je pred vecjim javnim lansiranjem priporoceno pregledati s pravnikom.
          </p>

          <h2 className="text-2xl font-bold text-white">Namen aplikacije</h2>
          <p>GarageBase je digitalna evidenca vozil za servisne zapise, gorivo, stroske, opomnike, PDF porocila, QR prenos zgodovine in osnovno analitiko vozila.</p>

          <h2 className="text-2xl font-bold text-white">Odgovornost uporabnika</h2>
          <p>Uporabnik je odgovoren za pravilnost podatkov, ki jih vnese v aplikacijo. Pred shranjevanjem naj preveri kilometre, datume, opise, racune in ostale podatke. Nekateri zapisi se po 24 urah zaklenejo.</p>

          <h2 className="text-2xl font-bold text-white">PDF in QR porocila</h2>
          <p>PDF in QR porocila so informativni digitalni zapisi na podlagi podatkov, ki jih vnese uporabnik. GarageBase ne jamci, da so podatki resnicni za obdobje pred uporabo aplikacije. Sistem pomaga prikazati sledljivo zgodovino od trenutka uporabe aplikacije naprej.</p>

          <h2 className="text-2xl font-bold text-white">Prepoved zlorab</h2>
          <p>Prepovedano je nalaganje nezakonitih vsebin, zloraba QR prenosov, poskus nepooblascenega dostopa, avtomatizirano obremenjevanje sistema ali uporaba aplikacije na nacin, ki skoduje drugim uporabnikom ali GarageBase.</p>

          <h2 className="text-2xl font-bold text-white">Dostopnost storitve</h2>
          <p>GarageBase je v razvoju in beta uporabi. Storitev se lahko spreminja, nadgrajuje, zacasno prekine ali omeji zaradi varnosti, vzdrzevanja, zlorab ali previsoke porabe.</p>

          <h2 className="text-2xl font-bold text-white">AI/OCR funkcije</h2>
          <p>AI/OCR branje racunov je trenutno v internem testiranju in je planirano za javno lansiranje v letu 2027. Funkcija ni del javne beta obljube in je lahko kasneje omejena ali placljiva.</p>

          <h2 className="text-2xl font-bold text-white">Omejitev odgovornosti</h2>
          <p>GarageBase ni nadomestilo za uradne evidence, pravni nasvet, davcni nasvet ali tehnicni pregled vozila. Uporabnik naj pomembne odlocitve preveri z ustreznimi dokumenti, strokovnjakom ali pristojno institucijo.</p>

          <h2 className="text-2xl font-bold text-white">Kontakt</h2>
          <p>Za vprasanja pisi na garagebase.app@gmail.com.</p>
        </section>
      </div>
    </main>
  )
}
