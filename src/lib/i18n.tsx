'use client'

import { useEffect, useState } from 'react'

export type Language = 'sl' | 'en'

type LabelKey = keyof typeof labels

export const supportedLanguages: Array<{ code: Language; label: string }> = [
  { code: 'sl', label: 'Slovenščina' },
  { code: 'en', label: 'English' },
]

const labels = {
  home: { sl: 'Domov', en: 'Home' },
  garage: { sl: 'Garaža', en: 'Garage' },
  fuel: { sl: 'Gorivo', en: 'Fuel' },
  service: { sl: 'Servis', en: 'Service' },
  costs: { sl: 'Stroški', en: 'Costs' },
  more: { sl: 'Več', en: 'More' },
  back: { sl: 'Nazaj', en: 'Back' },
} as const

const phrasePairs: Array<[string, string]> = [
  ['Domov', 'Home'], ['Nazaj', 'Back'], ['Garaža', 'Garage'], ['Gorivo', 'Fuel'], ['Servis', 'Service'], ['Stroški', 'Costs'], ['Več', 'More'],
  ['Prijava', 'Sign in'], ['Odjava', 'Sign out'], ['Registracija', 'Registration'], ['Ustvari račun', 'Create account'], ['Nimaš računa?', "Don't have an account?"], ['Že imaš račun?', 'Already have an account?'], ['Email naslov', 'Email address'], ['Vsaj 6 znakov', 'At least 6 characters'], ['Prosim počakaj...', 'Please wait...'], ['Prijava z biometrijo', 'Sign in with biometrics'], ['Tvoja avto evidenca — vse na enem mestu', 'Your vehicle records — all in one place'], ['Geslo', 'Password'], ['Email', 'Email'], ['Shrani', 'Save'], ['Prekliči', 'Cancel'], ['Izberi', 'Choose'], ['Nadaljuj', 'Continue'], ['Potrdi', 'Confirm'], ['Uredi', 'Edit'], ['Končaj', 'Done'], ['Dodaj', 'Add'], ['Dodaj avto', 'Add vehicle'], ['+ Avto', '+ Vehicle'], ['+ Dodaj', '+ Add'], ['+ Dodaj avto', '+ Add vehicle'],
  ['Nalaganje...', 'Loading...'], ['Shranjevanje...', 'Saving...'], ['Generiranje...', 'Generating...'], ['Preveri', 'Check'], ['Kamera', 'Camera'], ['Ustavi', 'Stop'], ['Scan', 'Scan'], ['Token ali link', 'Token or link'],
  ['Profil', 'Profile'], ['Free paket', 'Free plan'], ['Način uporabe', 'Usage mode'], ['Lite = enostavno, Full = vse možnosti', 'Lite = simple, Full = all options'], ['Enostaven prikaz za osnovno uporabo', 'Simple view for basic use'], ['Vse funkcije in napredne možnosti', 'All features and advanced options'],
  ['Jezik', 'Language'], ['Slovenščina', 'Slovenian'], ['English', 'English'], ['Velikost pisave', 'Font size'], ['Mala', 'Small'], ['Normalna', 'Normal'], ['Velika', 'Large'], ['Temni način', 'Dark mode'], ['Svetli način', 'Light mode'], ['Preklopi med temnim in svetlim', 'Switch between dark and light'],
  ['Obvestila', 'Notifications'], ['Opomniki za registracijo, servis in vinjeto', 'Reminders for registration, service and vignette'], ['Obvestila so vklopljena', 'Notifications are enabled'], ['Prejeli boste opomnike ob 8:00', 'You will receive reminders at 8:00'], ['Vklopi obvestila', 'Enable notifications'], ['Pošlji test', 'Send test'], ['Testno obvestilo poslano.', 'Test notification sent.'],
  ['Odklep aplikacije', 'App unlock'], ['Vklopi odklep', 'Enable unlock'], ['Izklopi odklep', 'Disable unlock'], ['Odklep aplikacije je vklopljen.', 'App unlock is enabled.'], ['Odklep aplikacije je izklopljen.', 'App unlock is disabled.'],
  ['Prikaz garaže', 'Garage view'], ['Višina kartic avtov na začetnem zaslonu', 'Vehicle card height on the home screen'], ['Malo', 'Small'], ['Srednje', 'Medium'], ['Veliko', 'Large'], ['Grid', 'Grid'], ['Več avtov', 'More vehicles'], ['Privzeto', 'Default'], ['Večje slike', 'Larger images'], ['kompaktno', 'compact'], ['Avtov v vrstici na webu', 'Vehicles per row on web'], ['Velja za računalnik in širši ekran', 'For desktop and wider screens'], ['Avtov v vrstici v app', 'Vehicles per row in app'], ['Velja za telefon in nameščeno aplikacijo', 'For phone and installed app'], ['Pisava na karticah', 'Card font size'], ['Velja za Malo, Srednje, Veliko in Grid', 'Applies to Small, Medium, Large and Grid'], ['Prikaži v grid kockici', 'Show in grid tile'], ['Prikaži na kartici', 'Show on card'], ['Registrska tablica', 'License plate'], ['Kilometri', 'Mileage'], ['Opomniki na kartici', 'Reminders on card'], ['Letnik', 'Year'], ['Opomniki', 'Reminders'], ['Prikaži datumske opomnike:', 'Show date reminders:'], ['Prikaži km opomnike:', 'Show km reminders:'], ['Nujni', 'Urgent'], ['Kmalu', 'Soon'], ['Vsi', 'All'], ['Vsi stroški', 'All costs'],
  ['Tvoja garaža je prazna', 'Your garage is empty'], ['Dodaj prvi avto in začni slediti stroškom', 'Add your first vehicle and start tracking costs'], ['Povleci avte da spreminjaš vrstni red', 'Drag vehicles to change their order'], ['Namesti', 'Install'],
  ['Izbrano vozilo', 'Selected vehicle'], ['Trenutni km', 'Current mileage'], ['Poraba', 'Consumption'], ['Poraba skupaj', 'Total consumption'], ['Zadnje tank.', 'Last fill-up'], ['Cena na km', 'Cost per km'], ['Stroški vozila', 'Vehicle costs'], ['Skupaj', 'Total'], ['skupaj', 'total'], ['Opomniki', 'Reminders'], ['Tehnični pregled', 'Roadworthiness test'], ['Zavarovanje', 'Insurance'], ['Vinjeta', 'Vignette'], ['Gume', 'Tires'], ['Report', 'Report'], ['Nastavitve', 'Settings'],
  ['Dodaj vozilo', 'Add vehicle'], ['Tip vozila', 'Vehicle type'], ['Avto', 'Car'], ['Motor', 'Motorcycle'], ['Kombi', 'Van'], ['Tovornjak', 'Truck'], ['Plovilo', 'Boat'], ['Drugo', 'Other'], ['Bencin', 'Petrol'], ['Diesel', 'Diesel'], ['Električni', 'Electric'], ['Hibrid', 'Hybrid'], ['Plin', 'Gas'], ['Vodik', 'Hydrogen'], ['Natančen tip vozila *', 'Exact vehicle type *'], ['Osnovni podatki', 'Basic information'], ['Znamka *', 'Make *'], ['Model *', 'Model *'], ['Znamka', 'Make'], ['Model', 'Model'], ['Trenutni km', 'Current mileage'], ['Barva', 'Color'], ['Napredni podatki', 'Advanced information'], ['po želji', 'optional'], ['Oblika', 'Body type'], ['Kubikaža (ccm)', 'Displacement (ccm)'], ['Moč (kW)', 'Power (kW)'], ['Menjalnik', 'Transmission'], ['Ročni', 'Manual'], ['Avtomatski', 'Automatic'], ['Polavtomatski', 'Semi-automatic'], ['Pogon', 'Drive'], ['Sprednji', 'Front'], ['Zadnji', 'Rear'], ['Shrani vozilo', 'Save vehicle'], ['Vozilo uspešno shranjeno!', 'Vehicle saved successfully!'],
  ['Nastavitve vozila', 'Vehicle settings'], ['VIN številka', 'VIN number'], ['Lastništvo in prenos', 'Ownership and transfer'], ['Št. lastnikov', 'No. of owners'], ['Mesto', 'City'], ['Starost', 'Age'], ['Dovolim prenos zgodovine', 'Allow history transfer'], ['Uporabi se za QR prenos in report za naslednjega lastnika.', 'Used for QR transfer and report for the next owner.'], ['Opomba pri prenosu', 'Transfer note'], ['Nastavitve shranjene!', 'Settings saved!'], ['Dodaj sliko', 'Add photo'], ['Zamenjaj', 'Replace'], ['Nalaganje', 'Uploading'],
  ['Vnos goriva', 'Fuel entry'], ['Vnos servisa', 'Service entry'], ['Vnos stroška', 'Expense entry'], ['Datum', 'Date'], ['Km', 'Mileage'], ['Litri', 'Liters'], ['Cena na liter', 'Price per liter'], ['Cena skupaj', 'Total price'], ['Postaja', 'Station'], ['Tip goriva', 'Fuel type'], ['Opis', 'Description'], ['Opis dela', 'Work performed'], ['Cena', 'Price'], ['Znesek', 'Amount'], ['Kategorija', 'Category'], ['Račun', 'Receipt'], ['Slike računov', 'Receipt photos'], ['Dodaj slike', 'Add photos'], ['Največ 3 slike na servis!', 'Maximum 3 photos per service!'], ['Servis uspešno shranjen!', 'Service saved successfully!'], ['Gorivo uspešno shranjeno!', 'Fuel saved successfully!'], ['Strošek uspešno shranjen!', 'Expense saved successfully!'], ['Km in opis sta obvezna!', 'Mileage and description are required!'], ['Km ne smejo biti nižji', 'Mileage cannot be lower'],
  ['Zgodovina goriva', 'Fuel history'], ['Zgodovina servisa', 'Service history'], ['Servisna knjiga', 'Service book'], ['Evidenca goriva', 'Fuel log'], ['Dodatni stroški', 'Additional costs'], ['Ni vnosov', 'No entries'], ['Ni podatkov', 'No data'], ['Ni vnesenih servisov.', 'No services entered.'], ['Ni vnesenih tankanj.', 'No fill-ups entered.'], ['Ni dodatnih stroškov.', 'No additional costs.'], ['Uredi vnos', 'Edit entry'], ['Shrani spremembe', 'Save changes'],
  ['PDF Report', 'PDF Report'], ['Vsebina reporta', 'Report content'], ['Servisov', 'Services'], ['Tankanij', 'Fill-ups'], ['Dodatnih stroškov', 'Additional costs'], ['Prilog računov', 'Receipt attachments'], ['Skupaj stroški', 'Total costs'], ['QR kode v PDF', 'QR codes in PDF'], ['Samo za branje', 'Read only'], ['QR za digitalni report.', 'QR for digital report.'], ['Izvoz zgodovine', 'History export'], ['QR za uvoz vozila.', 'QR for vehicle import.'], ['Slika vozila', 'Vehicle photo'], ['Slika v PDF in pri uvozu.', 'Photo in PDF and import.'], ['Prenese slike pri servisih.', 'Transfers service photos.'], ['Prenesi PDF Report', 'Download PDF Report'],
  ['Digitalni report iz GarageBase baze', 'Digital report from the GarageBase database'], ['Vozilo', 'Vehicle'], ['Lastnistvo', 'Ownership'], ['Pregled stroskov', 'Cost overview'], ['UVOZ', 'IMPORT'], ['BRANJE', 'READ'], ['Uvozi vozilo', 'Import vehicle'], ['Odpri racun', 'Open receipt'], ['Report je najden v GarageBase bazi.', 'Report found in the GarageBase database.'],
  ['Prenos zgodovine', 'History transfer'], ['Generiraj QR', 'Generate QR'], ['Skeniraj', 'Scan'], ['Uvoz vozila', 'Vehicle import'], ['Preverjanje', 'Verification'], ['Nizka prioriteta', 'Low priority'], ['Srednja prioriteta', 'Medium priority'], ['Visoka prioriteta', 'High priority'], ['Datum poteka', 'Expiry date'], ['Km opomnik', 'Mileage reminder'],
  ['Tvoja garaža. Vse na enem mestu.', 'Your garage. Everything in one place.'], ['Web + mobilna aplikacija', 'Web + mobile app'], ['Servisi, stroški, opomniki, gorivo in poročila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.', 'Services, costs, reminders, fuel and reports for every vehicle. Organized for everyday use and ready when selling a vehicle.'], ['Začni brezplačno', 'Start for free'], ['Oglej si funkcije', 'View features'], ['Funkcije', 'Features'], ['Paketi', 'Plans'], ['Kontakt', 'Contact'], ['Narejeno za realno uporabo vozila', 'Built for real vehicle use'], ['Poraba, tankanja in stroški po vozilih.', 'Consumption, fill-ups and costs by vehicle.'], ['Servisna knjiga z računi in kilometri.', 'Service book with receipts and mileage.'], ['Registracija, vinjeta, servis in zavarovanje.', 'Registration, vignette, service and insurance.'], ['Pregleden PDF za prodajo vozila.', 'Clear PDF for selling a vehicle.'], ['Mobilna app', 'Mobile app'], ['Namesti na telefon in uporabljaj kot aplikacijo.', 'Install on your phone and use it as an app.'], ['Več vozil', 'Multiple vehicles'], ['Celotna domača garaža na enem mestu.', 'Your whole home garage in one place.'], ['Začni z osnovno evidenco in kasneje dodaj report, QR prenos zgodovine in napredne funkcije.', 'Start with basic records and later add reports, QR history transfer and advanced features.'], ['1 vozilo', '1 vehicle'], ['2 vozili', '2 vehicles'], ['5 vozil', '5 vehicles'], ['namestitev', 'install'], ['report', 'report'], ['prenos', 'transfer'],
  ['Shrani nastavitve', 'Save settings'], ['Predlagane besede', 'Suggested words'], ['Autocomplete pri vnosu postaje in servisa', 'Autocomplete for station and service entry'], ['O aplikaciji', 'About the app'], ['Verzija', 'Version'], ['Spletna stran', 'Website'], ['Podpora', 'Support'],
  ['Feedback', 'Feedback'], ['Predlagaj funkcijo', 'Suggest a feature'], ['Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.', 'Send an idea, issue or suggestion to improve GarageBase.'], ['Odpri predloge', 'Open suggestions'],
  ['Kako zelis uporabljati aplikacijo?', 'How do you want to use the app?'], ['To lahko kadarkoli spremenis kasneje v nastavitvah.', 'You can change this later at any time in settings.'], ['Enostaven nacin', 'Simple mode'], ['Polni nacin', 'Full mode'], ['Za hiter vnos goriva, servisov, stroskov in osnovnih opomnikov.', 'For quick fuel, service, expense and basic reminder entries.'], ['Za vse funkcije, porocila, QR prenos, grafe in napredne nastavitve.', 'For all features, reports, QR transfer, charts and advanced settings.'], ['Manj gumbov', 'Fewer buttons'], ['Hitrejsi prvi zaslon', 'Faster first screen'], ['Primeren za vsakdanjo uporabo', 'Good for everyday use'], ['Vsi pregledi in zgodovine', 'All views and histories'], ['PDF report in QR prenos', 'PDF report and QR transfer'], ['Najvec nadzora', 'Most control'],
  ['Varnost', 'Security'], ['Odklep z biometrijo', 'Biometric unlock'], ['Zakleni app z odtisom, obrazom ali PIN-om naprave.', 'Lock the app with fingerprint, face or device PIN.'], ['Prenos', 'Transfer'], ['Skeniranje QR', 'QR scanning'], ['Preveri report ali uvozi zgodovino vozila od prejšnjega lastnika.', 'Verify a report or import vehicle history from the previous owner.'], ['Odpri Scan', 'Open Scan'],
  ['Skupni stroški', 'Total costs'], ['Zadnjih 6 mesecev', 'Last 6 months'], ['Razmerje stroškov', 'Cost ratio'], ['Servisi', 'Services'], ['Ostalo', 'Other'], ['+ Dodaj strošek', '+ Add expense'], ['Dodaj strošek', 'Add expense'], ['Filtrirano:', 'Filtered:'], ['Počisti filter', 'Clear filter'],
  ['Kilometri *', 'Mileage *'], ['Litri *', 'Liters *'], ['Cena/L (€)', 'Price/L (€)'], ['Postaja (po želji)', 'Station (optional)'], ['Skupna cena', 'Total price'], ['Shrani tankanje', 'Save fill-up'], ['Shrani tankanje →', 'Save fill-up →'], ['Tankanje uspešno shranjeno!', 'Fill-up saved successfully!'], ['najmanj', 'at least'], ['Poslušam... govori zdaj', 'Listening... speak now'], ['Naknaden vnos', 'Backdated entry'], ['zabeleženo bo kdaj je bilo dejansko vneseno', 'the actual entry time will be recorded'],
  ['Skupaj servisov', 'Total services'], ['Skupaj strošek', 'Total service cost'], ['+ Dodaj servis', '+ Add service'], ['Opravljeno delo', 'Work performed'], ['Tapni za detajle', 'Tap for details'], ['Tapni za detajle →', 'Tap for details →'], ['Ni priloženih računov', 'No receipt photos attached'],
  ['Dodaj opomnik', 'Add reminder'], ['Tip', 'Type'], ['Opozori X dni prej', 'Warn X days before'], ['Shranjujem...', 'Saving...'], ['Dodaj registracijo, vinjeto ali drug opomnik', 'Add registration, vignette or another reminder'], ['Drugo...', 'Other...'],
  ['Slike racunov', 'Receipt photos'], ['Slike računov', 'Receipt photos'], ['To vozilo ima priložene slike računov. V PDF reportu so označene z [ DA ] — za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com', 'This vehicle has attached receipt photos. In the PDF report they are marked with [ YES ] — ask the seller for access in the GarageBase app to view original photos at getgaragebase.com'], ['PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroške — idealno za prodajo vozila.', 'The PDF report contains the full service history, fuel log and expenses — ideal when selling a vehicle.'],
  ['Ime servisa (po želji)', 'Service name (optional)'], ['Cena (€)', 'Price (€)'], ['Slike računov (največ 3, max 2MB vsaka)', 'Receipt photos (maximum 3, max 2MB each)'], ['Dodaj sliko računa', 'Add receipt photo'], ['Naslednji servis', 'Next service'], ['Če vneseš interval, aplikacija sama ustvari opomnik.', 'If you enter an interval, the app creates a reminder automatically.'], ['Čez km', 'After km'], ['Čez dni', 'After days'], ['Shrani servis', 'Save service'], ['Shrani servis →', 'Save service →'], ['Nalaganje slik...', 'Uploading photos...'],
  ['Izbriši vozilo', 'Delete vehicle'], ['Ali res želiš izbrisati', 'Do you really want to delete'], ['Vsi podatki bodo trajno izgubljeni!', 'All data will be permanently lost!'], ['Si prepričan? Tega dejanja ni možno razveljaviti!', 'Are you sure? This action cannot be undone!'], ['npr. Vozilo redno servisirano, računi priloženi...', 'e.g. Vehicle regularly serviced, receipts attached...'],
  ['Homologacija', 'Homologation'], ['Vnesi številko, opombo ali priloži sliko/PDF homologacije.', 'Enter the number, a note or attach a homologation image/PDF.'], ['Številka homologacije', 'Homologation number'], ['Opis homologacije', 'Homologation description'], ['Odpri priloženo homologacijo', 'Open attached homologation'], ['Dodaj dokument ali sliko', 'Add document or image'], ['Zamenjaj dokument', 'Replace document'], ['Slika ali PDF dokument', 'Image or PDF document'], ['Homologacija uspešno naložena!', 'Homologation uploaded successfully!'],
]

const slToEn = new Map<string, string>()
for (const [sl, en] of phrasePairs) {
  slToEn.set(norm(sl), en)
}

const textOriginals = new WeakMap<Text, string>()
const translatedAttr = 'data-gb-i18n-original'

function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function splitDecor(value: string) {
  const trimmed = value.trim()
  const leading = trimmed.match(/^([^A-Za-z0-9A-Ža-ž]+\s*)/)?.[0] || ''
  const withoutLeading = leading ? trimmed.slice(leading.length) : trimmed
  const trailing = withoutLeading.match(/(\s*[→»]+)$/)?.[0] || ''
  const core = trailing ? withoutLeading.slice(0, -trailing.length) : withoutLeading
  return { leading, core: core.trim(), trailing }
}

function translateCore(value: string, language: Language): string {
  const clean = norm(value)
  if (!clean) return value
  if (language === 'sl') return value

  const exact = slToEn.get(clean)
  if (exact) return exact

  const { leading, core, trailing } = splitDecor(clean)
  const coreHit = slToEn.get(norm(core))
  if (coreHit) return `${leading}${coreHit}${trailing}`

  const checkbox = clean.match(/^(\[[xX ]\]\s*)(.+)$/)
  if (checkbox) {
    const translated = translateCore(checkbox[2], language)
    return `${checkbox[1]}${translated}`
  }

  const lastKm = clean.match(/^\((zadnji|trenutni):\s*([^)]+)\)$/i)
  if (lastKm) return `(${lastKm[1].toLowerCase() === 'zadnji' ? 'last' : 'current'}: ${lastKm[2]})`

  const warnDays = clean.match(/^opozori\s+(\d+)\s+dni prej$/i)
  if (warnDays) return `warn ${warnDays[1]} days before`

  if (clean.startsWith('⚠️ Naknaden vnos')) {
    return '⚠️ Backdated entry — the actual entry time will be recorded'
  }

  if (clean.startsWith('⚠️ Naknadno vnešen servis')) {
    return clean.replace('Naknadno vnešen servis', 'Backdated service entry').replace('zabeležen datum vnosa', 'entry date recorded')
  }

  const days = clean.match(/^(-?\d+)\s*dni$/i)
  if (days) return `${days[1]} days`
  const day = clean.match(/^(-?\d+)\s*dan$/i)
  if (day) return `${day[1]} day`
  const km = clean.match(/^([+\-]?\d+[\d.,]*)\s*km$/i)
  if (km) return `${km[1]} km`
  const eur = clean.match(/^([\d.,]+)\s*€$/)
  if (eur) return `€${eur[1]}`

  return value
}

export function translateText(value: string, language: Language): string {
  return translateCore(value, language)
}

function shouldSkipText(node: Text) {
  const parent = node.parentElement
  if (!parent) return true
  const tag = parent.tagName
  if (['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].includes(tag)) return true
  if (parent.closest('[data-gb-no-translate]')) return true
  return false
}

function translateTextNode(node: Text, language: Language) {
  if (shouldSkipText(node)) return
  const current = node.nodeValue || ''
  if (!textOriginals.has(node)) textOriginals.set(node, current)
  const original = textOriginals.get(node) || current
  node.nodeValue = language === 'sl' ? original : translateCore(original, language)
}

function translateAttribute(el: HTMLElement, attr: 'placeholder' | 'title' | 'aria-label', language: Language) {
  const value = el.getAttribute(attr)
  if (!value) return
  const key = `${translatedAttr}-${attr}`
  if (!el.hasAttribute(key)) el.setAttribute(key, value)
  const original = el.getAttribute(key) || value
  el.setAttribute(attr, language === 'sl' ? original : translateCore(original, language))
}

function translateDom(language: Language) {
  document.documentElement.lang = language
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  nodes.forEach(node => translateTextNode(node, language))

  document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach(el => {
    translateAttribute(el, 'placeholder', language)
    translateAttribute(el, 'title', language)
    translateAttribute(el, 'aria-label', language)
  })
}

export function GlobalTranslator() {
  const { language } = useLanguage()

  useEffect(() => {
    const run = () => translateDom(language)
    run()
    const observer = new MutationObserver(() => window.requestAnimationFrame(run))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [language])

  return null
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'sl'
  try {
    const raw = localStorage.getItem('garagebase_nastavitve')
    if (!raw) return 'sl'
    const parsed = JSON.parse(raw)
    return parsed.jezik === 'en' ? 'en' : 'sl'
  } catch {
    return 'sl'
  }
}

export function saveStoredLanguage(language: Language) {
  const raw = localStorage.getItem('garagebase_nastavitve')
  const current = raw ? JSON.parse(raw) : {}
  localStorage.setItem('garagebase_nastavitve', JSON.stringify({ ...current, jezik: language }))
  document.documentElement.lang = language
  window.dispatchEvent(new CustomEvent('garagebase-language-change', { detail: language }))
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('sl')

  useEffect(() => {
    setLanguage(getStoredLanguage())
    const onChange = (event: Event) => {
      setLanguage((event as CustomEvent<Language>).detail || getStoredLanguage())
    }
    window.addEventListener('garagebase-language-change', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('garagebase-language-change', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const t = (key: LabelKey) => labels[key]?.[language] || labels[key]?.sl || key
  return { language, t }
}
