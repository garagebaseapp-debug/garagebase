'use client'

import { saveStoredLanguage, useLanguage, type Language } from '@/lib/i18n'

const slSections = [
  {
    title: 'Namen aplikacije',
    body: [
      'GarageBase je digitalna evidenca vozil za gorivo, servise, stroške, opomnike, slike, PDF poročila, QR prenos zgodovine in osnovno analitiko vozila.',
      'Aplikacija je namenjena osebni ali poslovni evidenci. Ni uradna državna evidenca in ni nadomestilo za tehnični pregled, pravni nasvet, davčni nasvet ali strokovno cenitev vozila.',
    ],
  },
  {
    title: 'Beta in razvoj aplikacije',
    body: [
      'GarageBase je v razvoju. Funkcije se lahko dodajajo, spreminjajo, omejijo ali odstranijo, če je to potrebno zaradi varnosti, stabilnosti, stroškov, zlorab, pravnih zahtev ali izboljšave aplikacije.',
      'Pred javnim lansiranjem in med testiranjem naj uporabnik pomembne dokumente hrani tudi izven GarageBase. Aplikacija ni edina priporočena kopija kritično pomembnih dokazil.',
    ],
  },
  {
    title: 'Odgovornost uporabnika',
    body: [
      'Uporabnik je odgovoren za pravilnost podatkov, ki jih vnese, uvozi ali naloži. Pred shranjevanjem naj preveri kilometre, datume, zneske, opise, račune, slike in izbrane nastavitve poročila.',
      'Nekateri ročni zapisi se lahko po 24 urah zaklenejo zaradi sledljivosti zgodovine. Uvožena zgodovina je označena ločeno od GarageBase vnosov, kadar aplikacija to podpira.',
    ],
  },
  {
    title: 'PDF, QR in prodaja vozila',
    body: [
      'PDF in QR poročila so informativni digitalni zapisi na podlagi podatkov, ki jih vnese ali uvozi uporabnik.',
      'GarageBase ne jamči, da so podatki resnični za obdobje pred uporabo aplikacije. Sistem pomaga prikazati sledljivost in razločiti GarageBase vnose od uvožene zgodovine, kjer je to mogoče.',
      'Uporabnik sam odloča, katere podatke vključi v poročilo in komu ga pokaže.',
    ],
  },
  {
    title: 'Prepoved zlorab',
    body: [
      'Prepovedano je nalaganje nezakonitih vsebin, ponarejanje podatkov z namenom zavajanja, zloraba QR prenosov, poskus nepooblaščenega dostopa, avtomatizirano obremenjevanje sistema ali uporaba aplikacije na način, ki škoduje drugim uporabnikom ali GarageBase.',
      'GarageBase lahko zaradi zlorab omeji ali onemogoči dostop do računa ali posameznih funkcij.',
    ],
  },
  {
    title: 'Dostopnost in omejitve storitve',
    body: [
      'Trudimo se, da je aplikacija stabilna in varna, vendar ne jamčimo neprekinjene dostopnosti. Storitev je lahko začasno nedostopna zaradi vzdrževanja, napak, nadgradenj, ponudnikov infrastrukture ali varnostnih razlogov.',
      'GarageBase lahko uvede razumne fair-use omejitve za število vozil, slik, dokumentov, izvozov, QR prenosov, API klicev ali drugih virov.',
    ],
  },
  {
    title: 'Plačila in promocije',
    body: [
      'Če so funkcije v promocijskem ali beta obdobju brezplačno odklenjene, to ne pomeni trajne obljube brezplačne uporabe vseh prihodnjih funkcij.',
      'Če uvedemo plačljive pakete, bomo uporabnike o cenah, omejitvah in spremembah obvestili pred zaračunavanjem.',
    ],
  },
  {
    title: 'AI/OCR funkcije',
    body: [
      'AI/OCR branje računov je trenutno interno oziroma beta testiranje in ni javna obvezna funkcija. Lahko je omejeno, spremenjeno, začasno izklopljeno ali kasneje del plačljivega paketa.',
      'Uporabnik mora avtomatsko prebrane podatke vedno preveriti pred shranjevanjem.',
    ],
  },
  {
    title: 'Izbris računa',
    body: [
      'Uporabnik lahko v nastavitvah aplikacije zahteva izbris računa in povezanih podatkov. Zunanjo zahtevo lahko pošlje na garagebase.app@gmail.com z email naslova računa.',
      'Izbris je lahko trajen in ga ni vedno mogoče razveljaviti. Backup kopije se lahko hranijo omejen čas do izteka rednega backup cikla.',
    ],
  },
  {
    title: 'Spremembe pogojev',
    body: [
      'Te pogoje lahko posodobimo, kadar se spremenijo funkcije, zakonodaja, varnostne potrebe, poslovni model ali način delovanja aplikacije.',
      'Večje spremembe bomo objavili v aplikaciji ali na spletni strani.',
    ],
  },
]

const enSections = [
  {
    title: 'Purpose of the app',
    body: [
      'GarageBase is a digital vehicle record app for fuel, services, expenses, reminders, photos, PDF reports, QR history transfer and basic vehicle analytics.',
      'The app is intended for personal or business record keeping. It is not an official government record and does not replace a vehicle inspection, legal advice, tax advice or professional vehicle valuation.',
    ],
  },
  {
    title: 'Beta and app development',
    body: [
      'GarageBase is under development. Features may be added, changed, limited or removed when needed for safety, stability, costs, abuse prevention, legal requirements or app improvement.',
      'Before public launch and during testing, users should also keep important documents outside GarageBase. The app is not recommended as the only copy of critical evidence.',
    ],
  },
  {
    title: 'User responsibility',
    body: [
      'Users are responsible for the accuracy of data they enter, import or upload. Before saving, users should check mileage, dates, amounts, descriptions, receipts, photos and report settings.',
      'Some manual records may be locked after 24 hours for history traceability. Imported history is marked separately from GarageBase entries where the app supports it.',
    ],
  },
  {
    title: 'PDF, QR and vehicle sale',
    body: [
      'PDF and QR reports are informational digital records based on data entered or imported by the user.',
      'GarageBase does not guarantee that data is true for periods before the app was used. The system helps show traceability and distinguish GarageBase entries from imported history where possible.',
      'The user decides which data to include in a report and whom to share it with.',
    ],
  },
  {
    title: 'Abuse is prohibited',
    body: [
      'It is prohibited to upload illegal content, falsify data to mislead others, abuse QR transfers, attempt unauthorized access, overload the system automatically or use the app in a way that harms other users or GarageBase.',
      'GarageBase may limit or disable access to an account or specific features in case of abuse.',
    ],
  },
  {
    title: 'Availability and service limits',
    body: [
      'We work to keep the app stable and secure, but we do not guarantee uninterrupted availability. The service may be temporarily unavailable due to maintenance, errors, upgrades, infrastructure providers or security reasons.',
      'GarageBase may apply reasonable fair-use limits for vehicles, photos, documents, exports, QR transfers, API calls or other resources.',
    ],
  },
  {
    title: 'Payments and promotions',
    body: [
      'If features are unlocked for free during a promotion or beta period, this is not a permanent promise that all future features will remain free.',
      'If paid plans are introduced, users will be informed about prices, limits and changes before being charged.',
    ],
  },
  {
    title: 'AI/OCR features',
    body: [
      'AI/OCR receipt reading is currently internal or beta testing and is not a required public feature. It may be limited, changed, temporarily disabled or later included in a paid plan.',
      'Users must always verify automatically read data before saving.',
    ],
  },
  {
    title: 'Account deletion',
    body: [
      'Users can request deletion of their account and associated data in app settings. An external request can be sent to garagebase.app@gmail.com from the account email address.',
      'Deletion may be permanent and cannot always be reversed. Backup copies may remain for a limited time until the regular backup cycle expires.',
    ],
  },
  {
    title: 'Changes to these terms',
    body: [
      'We may update these terms when features, laws, security needs, business model or app operation change.',
      'Major changes will be published in the app or on the website.',
    ],
  },
]

const pageCopy = {
  sl: {
    back: 'Nazaj na GarageBase',
    title: 'Pogoji uporabe',
    updated: 'Zadnja posodobitev: 13. 5. 2026',
    sections: slSections,
  },
  en: {
    back: 'Back to GarageBase',
    title: 'Terms of Use',
    updated: 'Last updated: 13 May 2026',
    sections: enSections,
  },
} satisfies Record<Language, { back: string; title: string; updated: string; sections: typeof slSections }>

function LanguageSwitch({ language }: { language: Language }) {
  return (
    <div className="inline-flex rounded-xl border border-[#1e1e32] bg-[#0f0f1a] p-1">
      {[
        { code: 'sl' as Language, label: 'SL' },
        { code: 'en' as Language, label: 'EN' },
      ].map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => saveStoredLanguage(item.code)}
          className={`rounded-lg px-4 py-2 text-sm font-black transition-all ${
            language === item.code ? 'bg-[#6c63ff] text-white' : 'text-[#8a8aa8] hover:text-white'
          }`}
          aria-label={item.code === 'sl' ? 'Slovenščina' : 'English'}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function TermsSection({ title, body }: { title: string; body: string[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  )
}

export default function TermsPage() {
  const { language } = useLanguage()
  const t = pageCopy[language]

  return (
    <main data-gb-no-translate className="gb-legal-page min-h-screen bg-[#080810] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="text-sm font-semibold text-[#a09aff]">{t.back}</a>
          <LanguageSwitch language={language} />
        </div>

        <h1 className="mt-8 text-4xl font-black">{t.title}</h1>
        <p className="mt-3 text-[#8a8aa8]">{t.updated}</p>

        <div className="mt-8 space-y-8 leading-relaxed text-[#d8d8e8]">
          {t.sections.map((section) => (
            <TermsSection key={section.title} {...section} />
          ))}
        </div>
      </div>
    </main>
  )
}
