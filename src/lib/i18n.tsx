'use client'

import { useEffect, useState } from 'react'

export type Language = 'sl' | 'en'

type LabelKey = keyof typeof labels

export const supportedLanguages: Array<{ code: Language; label: string }> = [
  { code: 'sl', label: 'SlovenĹˇÄŤina' },
  { code: 'en', label: 'English' },
]

const labels = {
  home: { sl: 'Domov', en: 'Home' },
  garage: { sl: 'GaraĹľa', en: 'Garage' },
  fuel: { sl: 'Gorivo', en: 'Fuel' },
  service: { sl: 'Servis', en: 'Service' },
  costs: { sl: 'StroĹˇki', en: 'Costs' },
  more: { sl: 'VeÄŤ', en: 'More' },
  back: { sl: 'Nazaj', en: 'Back' },
} as const

const phrasePairs: Array<[string, string]> = [
  ['Domov', 'Home'], ['Nazaj', 'Back'], ['GaraĹľa', 'Garage'], ['Gorivo', 'Fuel'], ['Servis', 'Service'], ['StroĹˇki', 'Costs'], ['VeÄŤ', 'More'],
  ['Prijava', 'Sign in'], ['Odjava', 'Sign out'], ['Registracija', 'Registration'], ['Ustvari raÄŤun', 'Create account'], ['NimaĹˇ raÄŤuna?', "Don't have an account?"], ['Ĺ˝e imaĹˇ raÄŤun?', 'Already have an account?'], ['Email naslov', 'Email address'], ['Vsaj 6 znakov', 'At least 6 characters'], ['Prosim poÄŤakaj...', 'Please wait...'], ['Prijava z biometrijo', 'Sign in with biometrics'], ['Tvoja avto evidenca â€” vse na enem mestu', 'Your vehicle records â€” all in one place'], ['Geslo', 'Password'], ['Email', 'Email'], ['Shrani', 'Save'], ['PrekliÄŤi', 'Cancel'], ['Izberi', 'Choose'], ['Nadaljuj', 'Continue'], ['Potrdi', 'Confirm'], ['Uredi', 'Edit'], ['KonÄŤaj', 'Done'], ['Dodaj', 'Add'], ['Dodaj avto', 'Add vehicle'], ['+ Avto', '+ Vehicle'], ['+ Dodaj', '+ Add'], ['+ Dodaj avto', '+ Add vehicle'],
  ['Nalaganje...', 'Loading...'], ['Shranjevanje...', 'Saving...'], ['Generiranje...', 'Generating...'], ['Preveri', 'Check'], ['Kamera', 'Camera'], ['Ustavi', 'Stop'], ['Scan', 'Scan'], ['Token ali link', 'Token or link'],
  ['Profil', 'Profile'], ['Free paket', 'Free plan'], ['NaÄŤin uporabe', 'Usage mode'], ['Lite = enostavno, Full = vse moĹľnosti', 'Lite = simple, Full = all options'], ['Enostaven prikaz za osnovno uporabo', 'Simple view for basic use'], ['Vse funkcije in napredne moĹľnosti', 'All features and advanced options'],
  ['Jezik', 'Language'], ['SlovenĹˇÄŤina', 'Slovenian'], ['English', 'English'], ['Velikost pisave', 'Font size'], ['Mala', 'Small'], ['Normalna', 'Normal'], ['Velika', 'Large'], ['Temni naÄŤin', 'Dark mode'], ['Svetli naÄŤin', 'Light mode'], ['Preklopi med temnim in svetlim', 'Switch between dark and light'],
  ['Obvestila', 'Notifications'], ['Opomniki za registracijo, servis in vinjeto', 'Reminders for registration, service and vignette'], ['Obvestila so vklopljena', 'Notifications are enabled'], ['Prejeli boste opomnike ob 8:00', 'You will receive reminders at 8:00'], ['Vklopi obvestila', 'Enable notifications'], ['PoĹˇlji test', 'Send test'], ['Testno obvestilo poslano.', 'Test notification sent.'],
  ['Odklep aplikacije', 'App unlock'], ['Vklopi odklep', 'Enable unlock'], ['Izklopi odklep', 'Disable unlock'], ['Odklep aplikacije je vklopljen.', 'App unlock is enabled.'], ['Odklep aplikacije je izklopljen.', 'App unlock is disabled.'],
  ['Prikaz garaĹľe', 'Garage view'], ['ViĹˇina kartic avtov na zaÄŤetnem zaslonu', 'Vehicle card height on the home screen'], ['Malo', 'Small'], ['Srednje', 'Medium'], ['Veliko', 'Large'], ['Grid', 'Grid'], ['VeÄŤ avtov', 'More vehicles'], ['Privzeto', 'Default'], ['VeÄŤje slike', 'Larger images'], ['kompaktno', 'compact'], ['Avtov v vrstici na webu', 'Vehicles per row on web'], ['Velja za raÄŤunalnik in ĹˇirĹˇi ekran', 'For desktop and wider screens'], ['Avtov v vrstici v app', 'Vehicles per row in app'], ['Velja za telefon in nameĹˇÄŤeno aplikacijo', 'For phone and installed app'], ['Pisava na karticah', 'Card font size'], ['Velja za Malo, Srednje, Veliko in Grid', 'Applies to Small, Medium, Large and Grid'], ['PrikaĹľi v grid kockici', 'Show in grid tile'], ['PrikaĹľi na kartici', 'Show on card'], ['Registrska tablica', 'License plate'], ['Kilometri', 'Mileage'], ['Opomniki na kartici', 'Reminders on card'], ['Letnik', 'Year'], ['Opomniki', 'Reminders'], ['PrikaĹľi datumske opomnike:', 'Show date reminders:'], ['PrikaĹľi km opomnike:', 'Show km reminders:'], ['Nujni', 'Urgent'], ['Kmalu', 'Soon'], ['Vsi', 'All'], ['Vsi stroĹˇki', 'All costs'],
  ['Tvoja garaĹľa je prazna', 'Your garage is empty'], ['Dodaj prvi avto in zaÄŤni slediti stroĹˇkom', 'Add your first vehicle and start tracking costs'], ['Povleci avte da spreminjaĹˇ vrstni red', 'Drag vehicles to change their order'], ['Namesti', 'Install'],
  ['Izbrano vozilo', 'Selected vehicle'], ['Trenutni km', 'Current mileage'], ['Poraba', 'Consumption'], ['Poraba skupaj', 'Total consumption'], ['Zadnje tank.', 'Last fill-up'], ['Cena na km', 'Cost per km'], ['StroĹˇki vozila', 'Vehicle costs'], ['Skupaj', 'Total'], ['skupaj', 'total'], ['Opomniki', 'Reminders'], ['TehniÄŤni pregled', 'Roadworthiness test'], ['Zavarovanje', 'Insurance'], ['Vinjeta', 'Vignette'], ['Gume', 'Tires'], ['Report', 'Report'], ['Nastavitve', 'Settings'],
  ['Dodaj vozilo', 'Add vehicle'], ['Tip vozila', 'Vehicle type'], ['Avto', 'Car'], ['Motor', 'Motorcycle'], ['Kombi', 'Van'], ['Tovornjak', 'Truck'], ['Plovilo', 'Boat'], ['Drugo', 'Other'], ['Bencin', 'Petrol'], ['Diesel', 'Diesel'], ['ElektriÄŤni', 'Electric'], ['Hibrid', 'Hybrid'], ['Plin', 'Gas'], ['Vodik', 'Hydrogen'], ['NatanÄŤen tip vozila *', 'Exact vehicle type *'], ['Osnovni podatki', 'Basic information'], ['Znamka *', 'Make *'], ['Model *', 'Model *'], ['Znamka', 'Make'], ['Model', 'Model'], ['Trenutni km', 'Current mileage'], ['Barva', 'Color'], ['Napredni podatki', 'Advanced information'], ['po Ĺľelji', 'optional'], ['Oblika', 'Body type'], ['KubikaĹľa (ccm)', 'Displacement (ccm)'], ['MoÄŤ (kW)', 'Power (kW)'], ['Menjalnik', 'Transmission'], ['RoÄŤni', 'Manual'], ['Avtomatski', 'Automatic'], ['Polavtomatski', 'Semi-automatic'], ['Pogon', 'Drive'], ['Sprednji', 'Front'], ['Zadnji', 'Rear'], ['Shrani vozilo', 'Save vehicle'], ['Vozilo uspeĹˇno shranjeno!', 'Vehicle saved successfully!'],
  ['Nastavitve vozila', 'Vehicle settings'], ['VIN Ĺˇtevilka', 'VIN number'], ['LastniĹˇtvo in prenos', 'Ownership and transfer'], ['Ĺ t. lastnikov', 'No. of owners'], ['Mesto', 'City'], ['Starost', 'Age'], ['Dovolim prenos zgodovine', 'Allow history transfer'], ['Uporabi se za QR prenos in report za naslednjega lastnika.', 'Used for QR transfer and report for the next owner.'], ['Opomba pri prenosu', 'Transfer note'], ['Nastavitve shranjene!', 'Settings saved!'], ['Dodaj sliko', 'Add photo'], ['Zamenjaj', 'Replace'], ['Nalaganje', 'Uploading'],
  ['Vnos goriva', 'Fuel entry'], ['Vnos servisa', 'Service entry'], ['Vnos stroĹˇka', 'Expense entry'], ['Datum', 'Date'], ['Km', 'Mileage'], ['Litri', 'Liters'], ['Cena na liter', 'Price per liter'], ['Cena skupaj', 'Total price'], ['Postaja', 'Station'], ['Tip goriva', 'Fuel type'], ['Opis', 'Description'], ['Opis dela', 'Work performed'], ['Cena', 'Price'], ['Znesek', 'Amount'], ['Kategorija', 'Category'], ['RaÄŤun', 'Receipt'], ['Slike raÄŤunov', 'Receipt photos'], ['Dodaj slike', 'Add photos'], ['NajveÄŤ 3 slike na servis!', 'Maximum 3 photos per service!'], ['Servis uspeĹˇno shranjen!', 'Service saved successfully!'], ['Gorivo uspeĹˇno shranjeno!', 'Fuel saved successfully!'], ['StroĹˇek uspeĹˇno shranjen!', 'Expense saved successfully!'], ['Km in opis sta obvezna!', 'Mileage and description are required!'], ['Km ne smejo biti niĹľji', 'Mileage cannot be lower'],
  ['Zgodovina goriva', 'Fuel history'], ['Zgodovina servisa', 'Service history'], ['Servisna knjiga', 'Service book'], ['Evidenca goriva', 'Fuel log'], ['Dodatni stroĹˇki', 'Additional costs'], ['Ni vnosov', 'No entries'], ['Ni podatkov', 'No data'], ['Ni vnesenih servisov.', 'No services entered.'], ['Ni vnesenih tankanj.', 'No fill-ups entered.'], ['Ni dodatnih stroĹˇkov.', 'No additional costs.'], ['Uredi vnos', 'Edit entry'], ['Shrani spremembe', 'Save changes'],
  ['PDF Report', 'PDF Report'], ['Vsebina reporta', 'Report content'], ['Servisov', 'Services'], ['Tankanij', 'Fill-ups'], ['Dodatnih stroĹˇkov', 'Additional costs'], ['Prilog raÄŤunov', 'Receipt attachments'], ['Skupaj stroĹˇki', 'Total costs'], ['QR kode v PDF', 'QR codes in PDF'], ['Samo za branje', 'Read only'], ['QR za digitalni report.', 'QR for digital report.'], ['Izvoz zgodovine', 'History export'], ['QR za uvoz vozila.', 'QR for vehicle import.'], ['Slika vozila', 'Vehicle photo'], ['Slika v PDF in pri uvozu.', 'Photo in PDF and import.'], ['Prenese slike pri servisih.', 'Transfers service photos.'], ['Prenese slike racunov pri servisih, gorivu in stroskih.', 'Transfers receipt photos from services, fuel and expenses.'], ['Prenesi PDF Report', 'Download PDF Report'],
  ['Digitalni report iz GarageBase baze', 'Digital report from the GarageBase database'], ['Vozilo', 'Vehicle'], ['Lastnistvo', 'Ownership'], ['Pregled stroskov', 'Cost overview'], ['UVOZ', 'IMPORT'], ['BRANJE', 'READ'], ['Uvozi vozilo', 'Import vehicle'], ['Odpri racun', 'Open receipt'], ['Report je najden v GarageBase bazi.', 'Report found in the GarageBase database.'],
  ['Prenos zgodovine', 'History transfer'], ['Generiraj QR', 'Generate QR'], ['Skeniraj', 'Scan'], ['Uvoz vozila', 'Vehicle import'], ['Preverjanje', 'Verification'], ['Nizka prioriteta', 'Low priority'], ['Srednja prioriteta', 'Medium priority'], ['Visoka prioriteta', 'High priority'], ['Datum poteka', 'Expiry date'], ['Km opomnik', 'Mileage reminder'],
  ['Tvoja garaĹľa. Vse na enem mestu.', 'Your garage. Everything in one place.'], ['Web + mobilna aplikacija', 'Web + mobile app'], ['Servisi, stroĹˇki, opomniki, gorivo in poroÄŤila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.', 'Services, costs, reminders, fuel and reports for every vehicle. Organized for everyday use and ready when selling a vehicle.'], ['ZaÄŤni brezplaÄŤno', 'Start for free'], ['Oglej si funkcije', 'View features'], ['Funkcije', 'Features'], ['Paketi', 'Plans'], ['Kontakt', 'Contact'], ['Narejeno za realno uporabo vozila', 'Built for real vehicle use'], ['Poraba, tankanja in stroĹˇki po vozilih.', 'Consumption, fill-ups and costs by vehicle.'], ['Servisna knjiga z raÄŤuni in kilometri.', 'Service book with receipts and mileage.'], ['Registracija, vinjeta, servis in zavarovanje.', 'Registration, vignette, service and insurance.'], ['Pregleden PDF za prodajo vozila.', 'Clear PDF for selling a vehicle.'], ['Mobilna app', 'Mobile app'], ['Namesti na telefon in uporabljaj kot aplikacijo.', 'Install on your phone and use it as an app.'], ['VeÄŤ vozil', 'Multiple vehicles'], ['Celotna domaÄŤa garaĹľa na enem mestu.', 'Your whole home garage in one place.'], ['ZaÄŤni z osnovno evidenco in kasneje dodaj report, QR prenos zgodovine in napredne funkcije.', 'Start with basic records and later add reports, QR history transfer and advanced features.'], ['1 vozilo', '1 vehicle'], ['2 vozili', '2 vehicles'], ['5 vozil', '5 vehicles'], ['namestitev', 'install'], ['report', 'report'], ['prenos', 'transfer'],
  ['Shrani nastavitve', 'Save settings'], ['Predlagane besede', 'Suggested words'], ['Autocomplete pri vnosu postaje in servisa', 'Autocomplete for station and service entry'], ['O aplikaciji', 'About the app'], ['Verzija', 'Version'], ['Spletna stran', 'Website'], ['Podpora', 'Support'],
  ['Feedback', 'Feedback'], ['Predlagaj funkcijo', 'Suggest a feature'], ['Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.', 'Send an idea, issue or suggestion to improve GarageBase.'], ['Odpri predloge', 'Open suggestions'], ['Admin pregled predlogov', 'Admin suggestion inbox'],
  ['Kako zelis uporabljati aplikacijo?', 'How do you want to use the app?'], ['To lahko kadarkoli spremenis kasneje v nastavitvah.', 'You can change this later at any time in settings.'], ['Enostaven nacin', 'Simple mode'], ['Polni nacin', 'Full mode'], ['Za hiter vnos goriva, servisov, stroskov in osnovnih opomnikov.', 'For quick fuel, service, expense and basic reminder entries.'], ['Za vse funkcije, porocila, QR prenos, grafe in napredne nastavitve.', 'For all features, reports, QR transfer, charts and advanced settings.'], ['Manj gumbov', 'Fewer buttons'], ['Hitrejsi prvi zaslon', 'Faster first screen'], ['Primeren za vsakdanjo uporabo', 'Good for everyday use'], ['Vsi pregledi in zgodovine', 'All views and histories'], ['PDF report in QR prenos', 'PDF report and QR transfer'], ['Najvec nadzora', 'Most control'], ['Hitri vnos', 'Quick entry'], ['Lite nacin za najpogostejse akcije', 'Lite mode for the most common actions'], ['Strosek', 'Expense'], ['Opomnik', 'Reminder'],
  ['Pomoc', 'Help'], ['Pomocnik', 'Assistant'], ['Hitri vodic za osnovne funkcije GarageBase.', 'Quick guide for basic GarageBase features.'], ['Odpri pomocnika', 'Open assistant'], ['Hitri vodic po GarageBase.', 'Quick GarageBase guide.'], ['Dodaj prvo vozilo', 'Add first vehicle'], ['Slikaj racun', 'Scan receipt'], ['Slika racuna', 'Receipt photo'], ['Dodaj/slikaj racun', 'Add/scan receipt'], ['Odstrani sliko', 'Remove photo'], ['Preberi racun', 'Read receipt'], ['Berem...', 'Reading...'], ['Uporabi tekst', 'Use text'], ['Podatki so prebrani. Pred shranjevanjem jih se enkrat preveri.', 'Data was read. Check it once more before saving.'], ['Najprej dodaj ali slikaj racun.', 'First add or take a receipt photo.'], ['Ce avtomatsko branje ni podprto, prilepi tekst racuna sem...', 'If automatic reading is not supported, paste receipt text here...'], ['Ta brskalnik ne podpira avtomatskega branja teksta iz slike.', 'This browser does not support automatic text reading from images.'], ['Lahko prilepis tekst racuna spodaj in kliknes "Uporabi tekst".', 'You can paste receipt text below and click "Use text".'],
  ['Varnost', 'Security'], ['Odklep z biometrijo', 'Biometric unlock'], ['Zakleni app z odtisom, obrazom ali PIN-om naprave.', 'Lock the app with fingerprint, face or device PIN.'], ['Prenos', 'Transfer'], ['Skeniranje QR', 'QR scanning'], ['Preveri report ali uvozi zgodovino vozila od prejĹˇnjega lastnika.', 'Verify a report or import vehicle history from the previous owner.'], ['Odpri Scan', 'Open Scan'],
  ['Skupni stroĹˇki', 'Total costs'], ['Zadnjih 6 mesecev', 'Last 6 months'], ['Razmerje stroĹˇkov', 'Cost ratio'], ['Servisi', 'Services'], ['Ostalo', 'Other'], ['+ Dodaj stroĹˇek', '+ Add expense'], ['Dodaj stroĹˇek', 'Add expense'], ['Filtrirano:', 'Filtered:'], ['PoÄŤisti filter', 'Clear filter'],
  ['Kilometri *', 'Mileage *'], ['Litri *', 'Liters *'], ['Cena/L (â‚¬)', 'Price/L (â‚¬)'], ['Postaja (po Ĺľelji)', 'Station (optional)'], ['Skupna cena', 'Total price'], ['Shrani tankanje', 'Save fill-up'], ['Shrani tankanje â†’', 'Save fill-up â†’'], ['Tankanje uspeĹˇno shranjeno!', 'Fill-up saved successfully!'], ['najmanj', 'at least'], ['PosluĹˇam... govori zdaj', 'Listening... speak now'], ['Naknaden vnos', 'Backdated entry'], ['zabeleĹľeno bo kdaj je bilo dejansko vneseno', 'the actual entry time will be recorded'],
  ['Skupaj servisov', 'Total services'], ['Skupaj stroĹˇek', 'Total service cost'], ['+ Dodaj servis', '+ Add service'], ['Opravljeno delo', 'Work performed'], ['Tapni za detajle', 'Tap for details'], ['Tapni za detajle â†’', 'Tap for details â†’'], ['Ni priloĹľenih raÄŤunov', 'No receipt photos attached'],
  ['Dodaj opomnik', 'Add reminder'], ['Tip', 'Type'], ['Opozori X dni prej', 'Warn X days before'], ['Shranjujem...', 'Saving...'], ['Dodaj registracijo, vinjeto ali drug opomnik', 'Add registration, vignette or another reminder'], ['Drugo...', 'Other...'],
  ['Slike racunov', 'Receipt photos'], ['Slike raÄŤunov', 'Receipt photos'], ['To vozilo ima priloĹľene slike raÄŤunov. V PDF reportu so oznaÄŤene z [ DA ] â€” za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com', 'This vehicle has attached receipt photos. In the PDF report they are marked with [ YES ] â€” ask the seller for access in the GarageBase app to view original photos at getgaragebase.com'], ['PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroĹˇke â€” idealno za prodajo vozila.', 'The PDF report contains the full service history, fuel log and expenses â€” ideal when selling a vehicle.'],
  ['Ime servisa (po Ĺľelji)', 'Service name (optional)'], ['Cena (â‚¬)', 'Price (â‚¬)'], ['Slike raÄŤunov (najveÄŤ 3, max 2MB vsaka)', 'Receipt photos (maximum 3, max 2MB each)'], ['Dodaj sliko raÄŤuna', 'Add receipt photo'], ['Naslednji servis', 'Next service'], ['ÄŚe vneseĹˇ interval, aplikacija sama ustvari opomnik.', 'If you enter an interval, the app creates a reminder automatically.'], ['ÄŚez km', 'After km'], ['ÄŚez dni', 'After days'], ['Shrani servis', 'Save service'], ['Shrani servis â†’', 'Save service â†’'], ['Nalaganje slik...', 'Uploading photos...'],
  ['Preveri kilometre in podatke pred shranjevanjem', 'Check mileage and details before saving'], ['Servisni zapis lahko popravis samo prvih 24 ur. Po tem se Basic, Photo verified in Strong verified zapis zaklene, zato se enkrat preveri datum, kilometre, opis dela, racun in sliko stevca.', 'A service record can only be edited for the first 24 hours. After that, Basic, Photo verified and Strong verified records are locked, so check the date, mileage, work description, receipt and odometer photo once more.'],
  ['IzbriĹˇi vozilo', 'Delete vehicle'], ['Ali res ĹľeliĹˇ izbrisati', 'Do you really want to delete'], ['Vsi podatki bodo trajno izgubljeni!', 'All data will be permanently lost!'], ['Si prepriÄŤan? Tega dejanja ni moĹľno razveljaviti!', 'Are you sure? This action cannot be undone!'], ['npr. Vozilo redno servisirano, raÄŤuni priloĹľeni...', 'e.g. Vehicle regularly serviced, receipts attached...'],
  ['Homologacija', 'Homologation'], ['Vnesi Ĺˇtevilko, opombo ali priloĹľi sliko/PDF homologacije.', 'Enter the number, a note or attach a homologation image/PDF.'], ['Ĺ tevilka homologacije', 'Homologation number'], ['Opis homologacije', 'Homologation description'], ['Odpri priloĹľeno homologacijo', 'Open attached homologation'], ['Dodaj dokument ali sliko', 'Add document or image'], ['Zamenjaj dokument', 'Replace document'], ['Slika ali PDF dokument', 'Image or PDF document'], ['Homologacija uspeĹˇno naloĹľena!', 'Homologation uploaded successfully!'],
  ['Ponastavi geslo', 'Reset password'], ['Novo geslo', 'New password'], ['Pozabljeno geslo?', 'Forgot password?'], ['Pozabljeno geslo', 'Forgot password'], ['Shrani novo geslo', 'Save new password'], ['Geslo je spremenjeno. Zdaj se lahko prijaviš.', 'Password changed. You can sign in now.'], ['Vpiši novo geslo in ga shrani.', 'Enter a new password and save it.'], ['Najprej vpiši email naslov.', 'Enter your email address first.'], ['Poslali smo ti email povezavo za ponastavitev gesla.', 'We sent you a password reset link by email.'],
  ['Spremeni geslo', 'Change password'], ['Spremeni geslo ali si pošlji povezavo za ponastavitev.', 'Change your password or send yourself a reset link.'], ['Povezava za ponastavitev gesla je poslana na email.', 'Password reset link was sent to your email.'],
  ['Scan računov', 'Receipt scan'], ['AI skeniranje računov je planirano za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa že delujeta.', 'AI receipt scanning is planned for public launch in 2027. Manual entry and receipt photo storage already work.'], ['AI scan - prihaja v 2027', 'AI scan - coming in 2027'], ['AI/OCR branje računov je zaklenjeno za beta uporabnike.', 'AI/OCR receipt reading is locked for beta users.'], ['Funkcija je v internem testiranju in je planirana za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa delujeta normalno.', 'The feature is in internal testing and is planned for public launch in 2027. Manual entry and receipt photo storage work normally.'],
  ['Brez slike', 'No photo'], ['Slika števca', 'Odometer photo'], ['Števec + račun', 'Odometer + receipt'], ['Slika stevca (za Photo/Strong verified)', 'Odometer photo (for Photo/Strong verified)'], ['Dodaj/slikaj stevec kilometrov', 'Add/take odometer photo'], ['Odstrani sliko stevca', 'Remove odometer photo'],
  ['Korak 1/3 · najprej nujni podatki, nato opcijski.', 'Step 1/3 · required data first, then optional.'], ['Osnovno', 'Basic'], ['Dodatno', 'Advanced'], ['Naprej', 'Next'], ['Napredni podatki', 'Advanced information'],
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
  const leading = trimmed.match(/^([^A-Za-z0-9A-Ĺ˝a-Ĺľ]+\s*)/)?.[0] || ''
  const withoutLeading = leading ? trimmed.slice(leading.length) : trimmed
  const trailing = withoutLeading.match(/(\s*[â†’Â»]+)$/)?.[0] || ''
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

  if (clean.startsWith('âš ď¸Ź Naknaden vnos')) {
    return 'âš ď¸Ź Backdated entry â€” the actual entry time will be recorded'
  }

  if (clean.startsWith('âš ď¸Ź Naknadno vneĹˇen servis')) {
    return clean.replace('Naknadno vneĹˇen servis', 'Backdated service entry').replace('zabeleĹľen datum vnosa', 'entry date recorded')
  }

  const days = clean.match(/^(-?\d+)\s*dni$/i)
  if (days) return `${days[1]} days`
  const day = clean.match(/^(-?\d+)\s*dan$/i)
  if (day) return `${day[1]} day`
  const km = clean.match(/^([+\-]?\d+[\d.,]*)\s*km$/i)
  if (km) return `${km[1]} km`
  const eur = clean.match(/^([\d.,]+)\s*â‚¬$/)
  if (eur) return `â‚¬${eur[1]}`

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
