const slSections = [
  {
    title: 'Kdo smo',
    body: [
      'GarageBase je aplikacija za vodenje evidence vozil, goriva, servisov, stroškov, opomnikov, slik in poročil. Upravljavec aplikacije je GarageBase. Kontakt za zasebnost in podporo je garagebase.app@gmail.com.',
      'Ta politika opisuje trenutno javno/beta različico aplikacije. Če dodamo večje nove funkcije, na primer javni OCR/AI scan računov, plačila ali dodatno analitiko, bomo politiko posodobili.',
    ],
  },
  {
    title: 'Katere podatke lahko zbiramo',
    body: [
      'Podatki računa: email naslov, uporabniški ID, jezik, nastavitve aplikacije in podatki za prijavo prek Supabase Auth.',
      'Podatki vozila: znamka, model, letnik, gorivo, kilometri, registrska tablica, VIN, lastniški podatki, homologacija in druge informacije, ki jih uporabnik vnese.',
      'Evidenca uporabe: gorivo, servisi, stroški, opomniki, uvožena zgodovina, PDF/QR poročila in povezani zapisi.',
      'Slike in dokumenti: slike vozil, računi, slike števca, homologacija in drugi dokumenti, ki jih uporabnik sam naloži.',
      'Tehnični podatki: push subscription podatki, osnovni dogodki uporabe, napake, diagnostika in podatki potrebni za varnost, stabilnost in odpravljanje težav.',
    ],
  },
  {
    title: 'Zakaj podatke uporabljamo',
    body: [
      'Podatke uporabljamo za delovanje uporabniškega računa, prikaz garaže, shranjevanje zgodovine vozila, izračune porabe in stroškov, opomnike, PDF/QR poročila, varnost, podporo uporabnikom in izboljševanje aplikacije.',
      'Podatkov ne prodajamo. Podatke lahko obdelujejo ponudniki infrastrukture, ki jih uporabljamo za delovanje aplikacije, na primer Supabase, Vercel in ponudniki e-pošte ali push obvestil.',
    ],
  },
  {
    title: 'Slike, računi in občutljivi dokumenti',
    body: [
      'Slike računov, tablic, VIN številk in dokumentov lahko vsebujejo osebne ali poslovne podatke. Uporabnik naj naloži samo vsebine, ki jih sme hraniti in uporabljati.',
      'GarageBase lahko zaradi varnosti, stroškov, zlorab ali tehničnih omejitev omeji velikost, število ali trajanje hrambe slik in dokumentov.',
    ],
  },
  {
    title: 'AI/OCR scan računov',
    body: [
      'AI/OCR branje računov je trenutno v internem oziroma beta testiranju in ni del javne obljube aplikacije. Ročni vnos in shranjevanje slike računa sta ločeni funkciji.',
      'Če bo OCR/AI scan javno omogočen, bomo pred tem posodobili to politiko in Google Play Data Safety podatke, če bo to potrebno.',
    ],
  },
  {
    title: 'Hramba in brisanje podatkov',
    body: [
      'Podatke hranimo toliko časa, kot je potrebno za uporabo aplikacije, varnost, backup, odpravljanje napak in zakonske obveznosti.',
      'Uporabnik lahko v aplikaciji izbriše posamezne vnose, arhivira ali izbriše vozilo ter v nastavitvah zahteva izbris računa in povezanih podatkov. Za zunanjo zahtevo za izbris lahko uporabnik piše na garagebase.app@gmail.com z email naslova računa.',
      'Backup kopije se lahko hranijo omejen čas po izbrisu, dokler se ne izteče redni backup cikel.',
    ],
  },
  {
    title: 'Varnost',
    body: [
      'Podatki se prenašajo prek HTTPS povezav. Dostop do uporabniških podatkov je omejen s prijavo, Supabase varnostnimi pravili in administrativnimi pravicami.',
      'Noben sistem ni popolnoma brez tveganja. Pomembne dokumente in dokazila naj uporabnik hrani tudi izven GarageBase.',
    ],
  },
  {
    title: 'Pravice uporabnika',
    body: [
      'Uporabnik lahko zahteva dostop, popravek, izvoz, omejitev obdelave ali izbris podatkov, kjer je to zakonsko in tehnično izvedljivo.',
      'Za zahteve glede zasebnosti piši na garagebase.app@gmail.com.',
    ],
  },
]

const enSections = [
  {
    title: 'Who we are',
    body: [
      'GarageBase is an app for vehicle records, fuel, services, expenses, reminders, photos and reports. The app operator is GarageBase. The privacy and support contact is garagebase.app@gmail.com.',
      'This policy describes the current public/beta version of the app. If we add major new features, such as public OCR/AI receipt scanning, payments or additional analytics, we will update this policy.',
    ],
  },
  {
    title: 'Data we may collect',
    body: [
      'Account data: email address, user ID, language, app settings and sign-in data handled through Supabase Auth.',
      'Vehicle data: make, model, year, fuel type, mileage, license plate, VIN, ownership details, homologation and other information entered by the user.',
      'Usage records: fuel entries, service logs, expenses, reminders, imported history, PDF/QR reports and related records.',
      'Photos and documents: vehicle photos, receipts, odometer photos, homologation files and other documents uploaded by the user.',
      'Technical data: push subscription data, basic usage events, errors, diagnostics and data needed for security, stability and troubleshooting.',
    ],
  },
  {
    title: 'Why we use data',
    body: [
      'We use data to provide the account, garage view, vehicle history, consumption and cost calculations, reminders, PDF/QR reports, security, user support and app improvements.',
      'We do not sell user data. Data may be processed by infrastructure providers we use to operate the app, such as Supabase, Vercel and email or push notification providers.',
    ],
  },
  {
    title: 'Photos, receipts and sensitive documents',
    body: [
      'Photos of receipts, plates, VIN numbers and documents may contain personal or business information. Users should upload only content they are allowed to store and use.',
      'GarageBase may limit image and document size, quantity or retention for safety, cost, abuse prevention or technical reasons.',
    ],
  },
  {
    title: 'AI/OCR receipt scan',
    body: [
      'AI/OCR receipt reading is currently in internal or beta testing and is not part of the public app promise. Manual entry and receipt photo storage are separate features.',
      'If OCR/AI scan becomes publicly available, we will update this policy and Google Play Data Safety information where needed.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'We keep data as long as needed to provide the app, security, backups, troubleshooting and legal obligations.',
      'Users can delete individual entries, archive or delete vehicles, and request account deletion with associated data in app settings. For an external deletion request, users can email garagebase.app@gmail.com from the account email address.',
      'Backup copies may remain for a limited time after deletion until the regular backup cycle expires.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Data is transmitted over HTTPS. Access to user data is limited by sign-in, Supabase security rules and administrative permissions.',
      'No system is completely risk-free. Users should also keep important documents and evidence outside GarageBase.',
    ],
  },
  {
    title: 'User rights',
    body: [
      'Users may request access, correction, export, restriction of processing or deletion where legally and technically possible.',
      'For privacy requests, contact garagebase.app@gmail.com.',
    ],
  },
]

function PolicySection({ title, body }: { title: string; body: string[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080810] text-white px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-[#a09aff] text-sm font-semibold">Nazaj na GarageBase / Back to GarageBase</a>
        <h1 className="mt-6 text-4xl font-black">Politika zasebnosti</h1>
        <p className="mt-3 text-[#8a8aa8]">Zadnja posodobitev: 13. 5. 2026</p>

        <div className="mt-8 space-y-8 text-[#d8d8e8] leading-relaxed">
          {slSections.map((section) => (
            <PolicySection key={section.title} {...section} />
          ))}
        </div>

        <div className="my-12 border-t border-[#1e1e32]" />

        <h1 className="text-4xl font-black">Privacy Policy</h1>
        <p className="mt-3 text-[#8a8aa8]">Last updated: 13 May 2026</p>

        <div className="mt-8 space-y-8 text-[#d8d8e8] leading-relaxed">
          {enSections.map((section) => (
            <PolicySection key={section.title} {...section} />
          ))}
        </div>
      </div>
    </main>
  )
}
