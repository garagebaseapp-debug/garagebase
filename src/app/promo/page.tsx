export default function PromoPage() {
  return (
    <main className="min-h-screen bg-[#080810] text-white px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-[#a09aff] text-sm font-semibold">Nazaj na GarageBase</a>
        <h1 className="mt-6 text-4xl font-black">Launch promocija</h1>
        <p className="mt-3 text-[#8a8aa8]">Velja v obdobju beta/lansiranja.</p>

        <section className="mt-8 space-y-5 text-[#d8d8e8] leading-relaxed">
          <div className="rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-5">
            <p className="text-[#3ecfcf] font-black uppercase tracking-[0.16em] text-xs">Promocijski povzetek</p>
            <p className="mt-2 text-lg text-white">
              V obdobju lansiranja so funkcije GarageBase odklenjene brez doplacila do 31. 12. 2026, v okviru postene uporabe.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-white">Kaj pomeni odklenjeno do 31. 12. 2026</h2>
          <p>Uporabniki lahko v obdobju promocije uporabljajo javno dostopne funkcije GarageBase brez doplacila. To ne pomeni neomejene porabe serverjev, slik, izvoza, avtomatizacije ali prihodnjih funkcij.</p>

          <h2 className="text-2xl font-bold text-white">Postena uporaba</h2>
          <p>GarageBase lahko zaradi varnosti, zlorab, tehnicnih omejitev ali izjemno visoke porabe uvede razumne tehnicne omejitve, kot so omejitve slik, izvozov, QR prenosov, stevila vozil, API klicev ali podobnih virov.</p>

          <h2 className="text-2xl font-bold text-white">AI/OCR ni del javne beta obljube</h2>
          <p>AI/OCR branje racunov je v internem testiranju in planirano za javni lansiranje v letu 2027. Funkcija je lahko kasneje del placljivih paketov ali omejena z mesecnimi limiti.</p>

          <h2 className="text-2xl font-bold text-white">Placljivi paketi po promociji</h2>
          <p>Po 31. 12. 2026 bodo lahko napredne funkcije del placljivih paketov. Uporabnike bomo o paketih, cenah in spremembah obvestili vnaprej.</p>

          <h2 className="text-2xl font-bold text-white">Spremembe promocije</h2>
          <p>GarageBase si pridržuje pravico prilagoditi promocijske pogoje, ce je to potrebno zaradi varnosti, zlorab, stroskov infrastrukture, pravnih zahtev ali stabilnosti storitve.</p>
        </section>
      </div>
    </main>
  )
}
