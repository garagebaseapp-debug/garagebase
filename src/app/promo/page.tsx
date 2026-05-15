'use client'

import { useLanguage } from '@/lib/i18n'

const copy = {
  sl: {
    back: 'Nazaj na GarageBase',
    title: 'Launch promocija',
    subtitle: 'Velja v obdobju beta/lansiranja.',
    summary: 'Promocijski povzetek',
    lead: 'V obdobju lansiranja so funkcije GarageBase odklenjene brez doplačila do 31. 12. 2026, v okviru poštene uporabe.',
    packagesTitle: 'Okvirni paketi 2027',
    packagesText: 'Paketi so še v pripravi. Trenutno služijo kot roadmap, da uporabniki vidijo smer razvoja.',
    packages: [
      { name: 'Free', badge: 'Beta', text: 'Osnovna garaža, vnosi goriva, servisov, stroškov in opomnikov za vsakdanjo uporabo.' },
      { name: 'Basic', badge: '2027', text: 'Več prostora za slike, urejen izvoz podatkov in boljši pregled zgodovine vozila.' },
      { name: 'Pro', badge: '2027', text: 'Napredna poročila, primerjava vozil, boljši grafi in več avtomatizacije.' },
      { name: 'Premium', badge: '2027', text: 'AI/OCR, pametni predlogi, večje omejitve in dodatne funkcije za zahtevnejšo uporabo.' },
    ],
    sections: [
      {
        title: 'Kaj pomeni odklenjeno do 31. 12. 2026',
        text: 'Uporabniki lahko v obdobju promocije uporabljajo javno dostopne funkcije GarageBase brez doplačila. To ne pomeni neomejene porabe strežnikov, slik, izvoza, avtomatizacije ali prihodnjih funkcij.',
      },
      {
        title: 'Poštena uporaba',
        text: 'GarageBase lahko zaradi varnosti, zlorab, tehničnih omejitev ali izjemno visoke porabe uvede razumne tehnične omejitve, kot so omejitve slik, izvozov, QR prenosov, števila vozil, API klicev ali podobnih virov.',
      },
      {
        title: 'AI/OCR ni del javne beta obljube',
        text: 'AI/OCR branje računov je v internem testiranju in planirano za javno lansiranje v letu 2027. Funkcija je lahko kasneje del plačljivih paketov ali omejena z mesečnimi limiti.',
      },
      {
        title: 'Plačljivi paketi po promociji',
        text: 'Po 31. 12. 2026 bodo lahko napredne funkcije del plačljivih paketov. Uporabnike bomo o paketih, cenah in spremembah obvestili vnaprej.',
      },
      {
        title: 'Spremembe promocije',
        text: 'GarageBase si pridržuje pravico prilagoditi promocijske pogoje, če je to potrebno zaradi varnosti, zlorab, stroškov infrastrukture, pravnih zahtev ali stabilnosti storitve.',
      },
    ],
  },
  en: {
    back: 'Back to GarageBase',
    title: 'Launch promotion',
    subtitle: 'Applies during the beta/launch period.',
    summary: 'Promotion summary',
    lead: 'During the launch period, GarageBase features are unlocked at no extra charge until 31 Dec 2026, within fair use.',
    packagesTitle: 'Early 2027 plans',
    packagesText: 'Plans are still being prepared. For now they act as a roadmap so users can see where GarageBase is heading.',
    packages: [
      { name: 'Free', badge: 'Beta', text: 'Basic garage, fuel, service, expense and reminder entries for everyday use.' },
      { name: 'Basic', badge: '2027', text: 'More room for images, organized data export and a better vehicle history overview.' },
      { name: 'Pro', badge: '2027', text: 'Advanced reports, vehicle comparison, better charts and more automation.' },
      { name: 'Premium', badge: '2027', text: 'AI/OCR, smart suggestions, higher limits and extra features for heavier use.' },
    ],
    sections: [
      {
        title: 'What unlocked until 31 Dec 2026 means',
        text: 'During the promotion, users can use publicly available GarageBase features at no extra charge. This does not mean unlimited use of servers, images, exports, automation or future features.',
      },
      {
        title: 'Fair use',
        text: 'For safety, abuse prevention, technical limits or exceptionally high usage, GarageBase may apply reasonable technical limits such as limits on images, exports, QR transfers, vehicle count, API calls or similar resources.',
      },
      {
        title: 'AI/OCR is not part of the public beta promise',
        text: 'AI/OCR receipt reading is in internal testing and planned for public launch in 2027. The feature may later be part of paid plans or limited by monthly quotas.',
      },
      {
        title: 'Paid plans after the promotion',
        text: 'After 31 Dec 2026, advanced features may become part of paid plans. Users will be notified about packages, pricing and changes in advance.',
      },
      {
        title: 'Promotion changes',
        text: 'GarageBase reserves the right to adjust promotion terms if needed for safety, abuse prevention, infrastructure costs, legal requirements or service stability.',
      },
    ],
  },
}

export default function PromoPage() {
  const { language } = useLanguage()
  const t = copy[language]

  return (
    <main className="min-h-screen bg-[#080810] px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold text-[#a09aff]">{t.back}</a>
        <h1 className="mt-6 text-4xl font-black">{t.title}</h1>
        <p className="mt-3 text-[#8a8aa8]">{t.subtitle}</p>

        <section className="mt-8 space-y-5 leading-relaxed text-[#d8d8e8]">
          <div className="rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#3ecfcf]">{t.summary}</p>
            <p className="mt-2 text-lg text-white">{t.lead}</p>
          </div>

          <div className="rounded-2xl border border-[#6c63ff55] bg-[#6c63ff12] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a09aff]">Roadmap</p>
                <h2 className="mt-2 text-2xl font-black text-white">{t.packagesTitle}</h2>
              </div>
              <p className="max-w-md text-sm text-[#d8d8e8]">{t.packagesText}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {t.packages.map((plan) => (
                <div key={plan.name} className="rounded-2xl border border-[#2a2a40] bg-[#0f0f1a] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xl font-black text-white">{plan.name}</p>
                    <span className="rounded-full bg-[#6c63ff22] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#a09aff]">{plan.badge}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#c8c8dc]">{plan.text}</p>
                </div>
              ))}
            </div>
          </div>

          {t.sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-2xl font-bold text-white">{section.title}</h2>
              <p className="mt-2">{section.text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
