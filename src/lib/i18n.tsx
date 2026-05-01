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
  ['Prijava', 'Sign in'], ['Odjava', 'Sign out'], ['Registracija', 'Registration'], ['Ustvari račun', 'Create account'], ['Nimaš računa?', "Don't have an account?"], ['Že imaš račun?', 'Already have an account?'], ['Email naslov', 'Email address'], ['Vsaj 6 znakov', 'At least 6 characters'], ['Prosim počakaj...', 'Please wait...'], ['Prijava z biometrijo', 'Sign in with biometrics'], ['Tvoja avto evidenca - vse na enem mestu', 'Your vehicle records - all in one place'], ['Geslo', 'Password'], ['Email', 'Email'], ['Shrani', 'Save'], ['Prekliči', 'Cancel'], ['Izberi', 'Choose'], ['Nadaljuj', 'Continue'], ['Potrdi', 'Confirm'], ['Uredi', 'Edit'], ['Končaj', 'Done'], ['Dodaj', 'Add'], ['Dodaj avto', 'Add vehicle'], ['+ Avto', '+ Vehicle'], ['+ Dodaj', '+ Add'], ['+ Dodaj avto', '+ Add vehicle'],
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
  ['PDF Report', 'PDF Report'], ['Vsebina reporta', 'Report content'], ['Servisov', 'Services'], ['Tankanij', 'Fill-ups'], ['Dodatnih stroškov', 'Additional costs'], ['Prilog računov', 'Receipt attachments'], ['Skupaj stroški', 'Total costs'], ['QR kode v PDF', 'QR codes in PDF'], ['Samo za branje', 'Read only'], ['QR za digitalni report.', 'QR for digital report.'], ['Izvoz zgodovine', 'History export'], ['QR za uvoz vozila.', 'QR for vehicle import.'], ['Slika vozila', 'Vehicle photo'], ['Slika v PDF in pri uvozu.', 'Photo in PDF and import.'], ['Prenese slike pri servisih.', 'Transfers service photos.'], ['Prenese slike racunov pri servisih, gorivu in stroskih.', 'Transfers receipt photos from services, fuel and expenses.'], ['Prenesi PDF Report', 'Download PDF Report'],
  ['Digitalni report iz GarageBase baze', 'Digital report from the GarageBase database'], ['Vozilo', 'Vehicle'], ['Lastnistvo', 'Ownership'], ['Pregled stroskov', 'Cost overview'], ['UVOZ', 'IMPORT'], ['BRANJE', 'READ'], ['Uvozi vozilo', 'Import vehicle'], ['Odpri racun', 'Open receipt'], ['Report je najden v GarageBase bazi.', 'Report found in the GarageBase database.'],
  ['Prenos zgodovine', 'History transfer'], ['Generiraj QR', 'Generate QR'], ['Skeniraj', 'Scan'], ['Uvoz vozila', 'Vehicle import'], ['Preverjanje', 'Verification'], ['Nizka prioriteta', 'Low priority'], ['Srednja prioriteta', 'Medium priority'], ['Visoka prioriteta', 'High priority'], ['Datum poteka', 'Expiry date'], ['Km opomnik', 'Mileage reminder'],
  ['Tvoja garaža. Vse na enem mestu.', 'Your garage. Everything in one place.'], ['Web + mobilna aplikacija', 'Web + mobile app'], ['Servisi, stroški, opomniki, gorivo in poročila za vsako vozilo. Urejeno za vsakdanjo uporabo in pripravljeno za prodajo vozila.', 'Services, costs, reminders, fuel and reports for every vehicle. Organized for everyday use and ready when selling a vehicle.'], ['Začni brezplačno', 'Start for free'], ['Oglej si funkcije', 'View features'], ['Funkcije', 'Features'], ['Paketi', 'Plans'], ['Kontakt', 'Contact'], ['Narejeno za realno uporabo vozila', 'Built for real vehicle use'], ['Poraba, tankanja in stroški po vozilih.', 'Consumption, fill-ups and costs by vehicle.'], ['Servisna knjiga z računi in kilometri.', 'Service book with receipts and mileage.'], ['Registracija, vinjeta, servis in zavarovanje.', 'Registration, vignette, service and insurance.'], ['Pregleden PDF za prodajo vozila.', 'Clear PDF for selling a vehicle.'], ['Mobilna app', 'Mobile app'], ['Namesti na telefon in uporabljaj kot aplikacijo.', 'Install on your phone and use it as an app.'], ['Več vozil', 'Multiple vehicles'], ['Celotna domača garaža na enem mestu.', 'Your whole home garage in one place.'], ['Začni z osnovno evidenco in kasneje dodaj report, QR prenos zgodovine in napredne funkcije.', 'Start with basic records and later add reports, QR history transfer and advanced features.'], ['1 vozilo', '1 vehicle'], ['2 vozili', '2 vehicles'], ['5 vozil', '5 vehicles'], ['namestitev', 'install'], ['report', 'report'], ['prenos', 'transfer'],
  ['Shrani nastavitve', 'Save settings'], ['Predlagane besede', 'Suggested words'], ['Autocomplete pri vnosu postaje in servisa', 'Autocomplete for station and service entry'], ['O aplikaciji', 'About the app'], ['Verzija', 'Version'], ['Spletna stran', 'Website'], ['Podpora', 'Support'],
  ['Feedback', 'Feedback'], ['Predlagaj funkcijo', 'Suggest a feature'], ['Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.', 'Send an idea, issue or suggestion to improve GarageBase.'], ['Odpri predloge', 'Open suggestions'], ['Admin pregled predlogov', 'Admin suggestion inbox'],
  ['Kako zelis uporabljati aplikacijo?', 'How do you want to use the app?'], ['To lahko kadarkoli spremenis kasneje v nastavitvah.', 'You can change this later at any time in settings.'], ['Enostaven nacin', 'Simple mode'], ['Polni nacin', 'Full mode'], ['Za hiter vnos goriva, servisov, stroskov in osnovnih opomnikov.', 'For quick fuel, service, expense and basic reminder entries.'], ['Za vse funkcije, porocila, QR prenos, grafe in napredne nastavitve.', 'For all features, reports, QR transfer, charts and advanced settings.'], ['Manj gumbov', 'Fewer buttons'], ['Hitrejsi prvi zaslon', 'Faster first screen'], ['Primeren za vsakdanjo uporabo', 'Good for everyday use'], ['Vsi pregledi in zgodovine', 'All views and histories'], ['PDF report in QR prenos', 'PDF report and QR transfer'], ['Najvec nadzora', 'Most control'], ['Hitri vnos', 'Quick entry'], ['Lite nacin za najpogostejse akcije', 'Lite mode for the most common actions'], ['Strosek', 'Expense'], ['Opomnik', 'Reminder'],
  ['Pomoc', 'Help'], ['Pomocnik', 'Assistant'], ['Hitri vodic za osnovne funkcije GarageBase.', 'Quick guide for basic GarageBase features.'], ['Odpri pomocnika', 'Open assistant'], ['Hitri vodic po GarageBase.', 'Quick GarageBase guide.'], ['Dodaj prvo vozilo', 'Add first vehicle'], ['Slikaj racun', 'Scan receipt'], ['Slika racuna', 'Receipt photo'], ['Dodaj/slikaj racun', 'Add/scan receipt'], ['Odstrani sliko', 'Remove photo'], ['Preberi racun', 'Read receipt'], ['Berem...', 'Reading...'], ['Uporabi tekst', 'Use text'], ['Podatki so prebrani. Pred shranjevanjem jih se enkrat preveri.', 'Data was read. Check it once more before saving.'], ['Najprej dodaj ali slikaj racun.', 'First add or take a receipt photo.'], ['Ce avtomatsko branje ni podprto, prilepi tekst racuna sem...', 'If automatic reading is not supported, paste receipt text here...'], ['Ta brskalnik ne podpira avtomatskega branja teksta iz slike.', 'This browser does not support automatic text reading from images.'], ['Lahko prilepis tekst racuna spodaj in kliknes "Uporabi tekst".', 'You can paste receipt text below and click "Use text".'],
  ['Varnost', 'Security'], ['Odklep z biometrijo', 'Biometric unlock'], ['Zakleni app z odtisom, obrazom ali PIN-om naprave.', 'Lock the app with fingerprint, face or device PIN.'], ['Prenos', 'Transfer'], ['Skeniranje QR', 'QR scanning'], ['Preveri report ali uvozi zgodovino vozila od prejšnjega lastnika.', 'Verify a report or import vehicle history from the previous owner.'], ['Odpri Scan', 'Open Scan'],
  ['Skupni stroški', 'Total costs'], ['Zadnjih 6 mesecev', 'Last 6 months'], ['Razmerje stroškov', 'Cost ratio'], ['Servisi', 'Services'], ['Ostalo', 'Other'], ['+ Dodaj strošek', '+ Add expense'], ['Dodaj strošek', 'Add expense'], ['Filtrirano:', 'Filtered:'], ['Počisti filter', 'Clear filter'],
  ['Kilometri *', 'Mileage *'], ['Litri *', 'Liters *'], ['Cena/L (€)', 'Price/L (€)'], ['Postaja (po želji)', 'Station (optional)'], ['Skupna cena', 'Total price'], ['Shrani tankanje', 'Save fill-up'], ['Shrani tankanje →', 'Save fill-up →'], ['Tankanje uspešno shranjeno!', 'Fill-up saved successfully!'], ['najmanj', 'at least'], ['Poslušam... govori zdaj', 'Listening... speak now'], ['Naknaden vnos', 'Backdated entry'], ['zabeleženo bo kdaj je bilo dejansko vneseno', 'the actual entry time will be recorded'],
  ['Skupaj servisov', 'Total services'], ['Skupaj strošek', 'Total service cost'], ['+ Dodaj servis', '+ Add service'], ['Opravljeno delo', 'Work performed'], ['Tapni za detajle', 'Tap for details'], ['Tapni za detajle →', 'Tap for details →'], ['Ni priloženih računov', 'No receipt photos attached'],
  ['Dodaj opomnik', 'Add reminder'], ['Tip', 'Type'], ['Opozori X dni prej', 'Warn X days before'], ['Shranjujem...', 'Saving...'], ['Dodaj registracijo, vinjeto ali drug opomnik', 'Add registration, vignette or another reminder'], ['Drugo...', 'Other...'],
  ['Slike racunov', 'Receipt photos'], ['Slike računov', 'Receipt photos'], ['To vozilo ima priložene slike računov. V PDF reportu so označene z [ DA ] - za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com', 'This vehicle has attached receipt photos. In the PDF report they are marked with [ YES ] - ask the seller for access in the GarageBase app to view original photos at getgaragebase.com'], ['PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroške - idealno za prodajo vozila.', 'The PDF report contains the full service history, fuel log and expenses - ideal when selling a vehicle.'],
  ['Ime servisa (po želji)', 'Service name (optional)'], ['Cena (€)', 'Price (€)'], ['Slike računov (največ 3, max 2MB vsaka)', 'Receipt photos (maximum 3, max 2MB each)'], ['Dodaj sliko računa', 'Add receipt photo'], ['Naslednji servis', 'Next service'], ['Če vneseš interval, aplikacija sama ustvari opomnik.', 'If you enter an interval, the app creates a reminder automatically.'], ['Čez km', 'After km'], ['Čez dni', 'After days'], ['Shrani servis', 'Save service'], ['Shrani servis →', 'Save service →'], ['Nalaganje slik...', 'Uploading photos...'],
  ['Preveri kilometre in podatke pred shranjevanjem', 'Check mileage and details before saving'], ['Servisni zapis lahko popravis samo prvih 24 ur. Po tem se Basic, Photo verified in Strong verified zapis zaklene, zato se enkrat preveri datum, kilometre, opis dela, racun in sliko stevca.', 'A service record can only be edited for the first 24 hours. After that, Basic, Photo verified and Strong verified records are locked, so check the date, mileage, work description, receipt and odometer photo once more.'],
  ['Izbriši vozilo', 'Delete vehicle'], ['Ali res želiš izbrisati', 'Do you really want to delete'], ['Vsi podatki bodo trajno izgubljeni!', 'All data will be permanently lost!'], ['Si prepričan? Tega dejanja ni možno razveljaviti!', 'Are you sure? This action cannot be undone!'], ['npr. Vozilo redno servisirano, računi priloženi...', 'e.g. Vehicle regularly serviced, receipts attached...'],
  ['Homologacija', 'Homologation'], ['Vnesi številko, opombo ali priloži sliko/PDF homologacije.', 'Enter the number, a note or attach a homologation image/PDF.'], ['Številka homologacije', 'Homologation number'], ['Opis homologacije', 'Homologation description'], ['Odpri priloženo homologacijo', 'Open attached homologation'], ['Dodaj dokument ali sliko', 'Add document or image'], ['Zamenjaj dokument', 'Replace document'], ['Slika ali PDF dokument', 'Image or PDF document'], ['Homologacija uspešno naložena!', 'Homologation uploaded successfully!'],
  ['Ponastavi geslo', 'Reset password'], ['Novo geslo', 'New password'], ['Pozabljeno geslo?', 'Forgot password?'], ['Pozabljeno geslo', 'Forgot password'], ['Shrani novo geslo', 'Save new password'], ['Geslo je spremenjeno. Zdaj se lahko prijaviš.', 'Password changed. You can sign in now.'], ['Vpiši novo geslo in ga shrani.', 'Enter a new password and save it.'], ['Najprej vpiši email naslov.', 'Enter your email address first.'], ['Poslali smo ti email povezavo za ponastavitev gesla.', 'We sent you a password reset link by email.'],
  ['Spremeni geslo', 'Change password'], ['Spremeni geslo ali si pošlji povezavo za ponastavitev.', 'Change your password or send yourself a reset link.'], ['Povezava za ponastavitev gesla je poslana na email.', 'Password reset link was sent to your email.'],
  ['Scan računov', 'Receipt scan'], ['AI skeniranje računov je planirano za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa že delujeta.', 'AI receipt scanning is planned for public launch in 2027. Manual entry and receipt photo storage already work.'], ['AI scan - prihaja v 2027', 'AI scan - coming in 2027'], ['AI/OCR branje računov je zaklenjeno za beta uporabnike.', 'AI/OCR receipt reading is locked for beta users.'], ['Funkcija je v internem testiranju in je planirana za javni zagon v letu 2027. Ročni vnos in shranjevanje slike računa delujeta normalno.', 'The feature is in internal testing and is planned for public launch in 2027. Manual entry and receipt photo storage work normally.'],
  ['Brez slike', 'No photo'], ['Slika števca', 'Odometer photo'], ['Števec + račun', 'Odometer + receipt'], ['Slika stevca (za Photo/Strong verified)', 'Odometer photo (for Photo/Strong verified)'], ['Dodaj/slikaj stevec kilometrov', 'Add/take odometer photo'], ['Odstrani sliko stevca', 'Remove odometer photo'],
  ['Korak 1/3 · najprej nujni podatki, nato opcijski.', 'Step 1/3 · required data first, then optional.'], ['Osnovno', 'Basic'], ['Dodatno', 'Advanced'], ['Naprej', 'Next'], ['Napredni podatki', 'Advanced information'],
]

const extraPhrasePairs: Array<[string, string]> = [
  ['Vse nastavitve', 'All settings'],
  ['Uredi prikaz, varnost, jezik, prenos podatkov in delovanje aplikacije na enem mestu.', 'Manage display, security, language, data transfer and app behavior in one place.'],
  ['Pomoč', 'Help'],
  ['Aplikacija', 'App'],
  ['Admin panel', 'Admin panel'],
  ['☀️ Svetli način', '☀️ Light mode'],
  ['🌙 Temni način', '🌙 Dark mode'],
  ['Geslo mora imeti vsaj 6 znakov.', 'Password must have at least 6 characters.'],
  ['Geslo je spremenjeno.', 'Password has been changed.'],
  ['Za potrditev vpiši IZBRISI.', 'Type IZBRISI to confirm.'],
  ['Brisanje računa', 'Delete account'],
  ['Izbriši račun in vse podatke', 'Delete account and all data'],
  ['To izbriše vozila, servise, tankanja, stroške, opomnike, slike, QR prenose, feedback in prijavo.', 'This deletes vehicles, services, fill-ups, expenses, reminders, photos, QR transfers, feedback and the account.'],
  ['Pozor: po potrditvi podatkov ne moremo več obnoviti. Če si prepričan, vpiši IZBRISI.', 'Warning: after confirmation the data cannot be restored. If you are sure, type IZBRISI.'],
  ['Brišem...', 'Deleting...'],
  ['Dokončno izbriši', 'Delete permanently'],
  ['Opomniki se pošiljajo po spodnjih nastavitvah.', 'Reminders are sent using the settings below.'],
  ['Glavni vklop obvestil', 'Main notification switch'],
  ['Če je izklopljeno, ne pošiljamo opomnikov.', 'When disabled, reminders are not sent.'],
  ['Datumski opomniki', 'Date reminders'],
  ['Registracija, vinjeta, tehnični, zavarovanje.', 'Registration, vignette, roadworthiness and insurance.'],
  ['KM opomniki', 'Mileage reminders'],
  ['Servis ali drug opomnik po kilometrih.', 'Service or another mileage-based reminder.'],
  ['Prehod prioritet', 'Priority changes'],
  ['Obvestilo pri prehodu zelena -> rumena ali rumena -> rdeča.', 'Notification when a reminder changes from green to yellow or yellow to red.'],
  ['Dnevni rdeči opomnik', 'Daily urgent reminder'],
  ['Obvestila se pošljejo enkrat na dan ob izbrani uri, če imaš aktivne opomnike.', 'Notifications are sent once per day at the selected time if you have active reminders.'],
  ['Ura pošiljanja', 'Send time'],
  ['Shrani nastavitve obvestil', 'Save notification settings'],
  ['Pošiljam test...', 'Sending test...'],
  ['Pošiljam iz baze...', 'Sending from database...'],
  ['Pošlji test iz baze', 'Send database test'],
  ['Test opomnikov zdaj', 'Test reminders now'],
  ['Izklopi obvestila na tej napravi', 'Disable notifications on this device'],
  ['Obvestila niso povezana s tem telefonom. Klikni Vklopi obvestila.', 'Notifications are not connected to this phone. Tap Enable notifications.'],
  ['Push ključi niso nastavljeni.', 'Push keys are not configured.'],
  ['❌ Napaka pri vklopu obvestil.', '❌ Error enabling notifications.'],
  ['Če vidiš to obvestilo, push deluje.', 'If you see this notification, push works.'],
  ['Stara push povezava je potekla. Klikni Vklopi obvestila in potem se enkrat Poslji test.', 'The old push connection expired. Tap Enable notifications and then Send test again.'],
  ['Test poslan. Najprej mora priti lokalni test, nato server push.', 'Test sent. First the local test should arrive, then server push.'],
  ['Telefon nima aktivne push povezave. Najprej klikni Vklopi obvestila.', 'This phone has no active push connection. Tap Enable notifications first.'],
  ['Obvestila so izklopljena na tej napravi.', 'Notifications are disabled on this device.'],
  ['Obvestil ni bilo mogoce izklopiti.', 'Could not disable notifications.'],
  ['Nastavitve obvestil so shranjene.', 'Notification settings are saved.'],
  ['Ta naprava ali brskalnik ne podpira varnega biometričnega odklepa.', 'This device or browser does not support secure biometric unlock.'],
  ['Odklepa ni bilo mogoče vklopiti. Poskusi na telefonu v nameščeni aplikaciji.', 'Unlock could not be enabled. Try on your phone in the installed app.'],
  ['SI Slovenščina', 'SI Slovenian'],
  ['Samo osnove, brez kompleksnih nastavitev', 'Only basics, without complex settings'],
  ['Vse funkcije in napredne nastavitve', 'All features and advanced settings'],
  ['Predlagaj funkcijo', 'Suggest a feature'],
  ['Poslji idejo, tezavo ali predlog za izboljsavo GarageBase.', 'Send an idea, issue or suggestion to improve GarageBase.'],
  ['Prijavi napako', 'Report a bug'],
  ['Admin pregled napak', 'Admin bug inbox'],
  ['Odpri predloge', 'Open suggestions'],
  ['Odpri pomočnika', 'Open assistant'],
  ['Odpri pomocnika', 'Open assistant'],
  ['Predlagane besede', 'Suggested words'],
  ['Autocomplete pri vnosu postaje in servisa', 'Autocomplete for station and service entry'],
  ['Vlačilec', 'Tractor unit'],
  ['Čoln', 'Boat'],
  ['Natančen tip vozila *', 'Exact vehicle type *'],
  ['npr. Štirikoles, Traktor, Quad...', 'e.g. ATV, tractor, quad...'],
  ['Znamka in model sta obvezna!', 'Make and model are required!'],
  ['Znamka in model sta nujna podatka.', 'Make and model are required data.'],
  ['Znamka in model sta nujna. Ostalo lahko dopolniš kasneje.', 'Make and model are required. You can complete the rest later.'],
  ['Najprej vnesi tip vozila.', 'Enter the vehicle type first.'],
  ['Vnesi tip vozila!', 'Enter the vehicle type!'],
  ['✅ Vozilo uspešno shranjeno!', '✅ Vehicle saved successfully!'],
  ['Shrani vozilo →', 'Save vehicle →'],
  ['Naprej →', 'Next →'],
  ['npr. Volvo', 'e.g. Volvo'],
  ['npr. XC90', 'e.g. XC90'],
  ['npr. 54200', 'e.g. 54200'],
  ['npr. LJ X9-MK1', 'e.g. LJ X9-MK1'],
  ['npr. Siva metalik', 'e.g. Grey metallic'],
  ['npr. 1968', 'e.g. 1968'],
  ['npr. 140', 'e.g. 140'],
  ['Kubikaža (ccm)', 'Displacement (ccm)'],
  ['Moč (kW)', 'Power (kW)'],
  ['Ročni', 'Manual'],
  ['✓ Končaj', '✓ Done'],
  ['⇅ Uredi', '⇅ Edit'],
  ['Aktivna vozila', 'Active vehicles'],
  ['Arhiv', 'Archive'],
  ['Za arhiv najprej zazeni SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql.', 'For archive, run SUPABASE_MIGRACIJA_ARHIV_VOZIL.sql first.'],
  ['Vnesi datum ali km!', 'Enter a date or mileage!'],
  ['Vnesi naziv opomnika!', 'Enter a reminder name!'],
  ['Vnesi število dni!', 'Enter the number of days!'],
  ['Za koledar mora imeti opomnik datum.', 'A reminder needs a date to export to calendar.'],
  ['npr. Menjava žarnic...', 'e.g. Bulb replacement...'],
  ['npr. 45', 'e.g. 45'],
  ['Kje je napaka?', 'Where is the issue?'],
  ['Kaj si pričakoval?', 'What did you expect?'],
  ['Vnesi kratek naslov in opis napake.', 'Enter a short title and issue description.'],
  ['Napake ni bilo mogoče poslati. Zaženi SQL za bug_reports tabelo.', 'The bug report could not be sent. Run the SQL for the bug_reports table.'],
  ['Hvala, napaka je poslana v admin panel.', 'Thank you, the bug report was sent to the admin panel.'],
  ['Napiši toliko, da lahko napako ponovimo in popravimo.', 'Write enough detail so we can reproduce and fix the issue.'],
  ['npr. Obvestilo se ne pošlje', 'e.g. Notification is not sent'],
  ['Opiši napako, zaslon in kdaj se pojavi.', 'Describe the issue, screen and when it appears.'],
  ['1. Odpri ... 2. Klikni ... 3. Zgodi se ...', '1. Open ... 2. Tap ... 3. This happens ...'],
  ['Pošiljam...', 'Sending...'],
  ['Pošlji prijavo napake', 'Send bug report'],
  ['Predloga ni bilo mogoce shraniti. Preveri, da si zagnal SQL za feedback tabelo.', 'The suggestion could not be saved. Check that you ran the SQL for the feedback table.'],
  ['npr. Samodejno branje racuna za gorivo...', 'e.g. Automatic fuel receipt reading...'],
  ['npr. Prihranilo bi cas pri vsakem tankanju...', 'e.g. It would save time on every fill-up...'],
  ['Poslji predlog', 'Send suggestion'],
  ['Slike racuna ni bilo mogoce pripraviti.', 'Receipt photos could not be prepared.'],
  ['Slike računa ni bilo mogoče pripraviti.', 'Receipt photos could not be prepared.'],
  ['Slike stevca ni bilo mogoce pripraviti.', 'Odometer photo could not be prepared.'],
  ['Glasovni vnos ni podprt v tem brskalniku.', 'Voice input is not supported in this browser.'],
  ['Napaka pri glasovnem vnosu.', 'Voice input error.'],
  ['Nisem razumel', 'I did not understand'],
  ['Poskusi znova.', 'Try again.'],
  ['Km in litri sta obvezna!', 'Mileage and liters are required!'],
  ['Km in opis sta obvezna!', 'Mileage and work description are required!'],
  ['Vnesi naziv stroška!', 'Enter the expense name!'],
  ['✅ Tankanje uspešno shranjeno!', '✅ Fill-up saved successfully!'],
  ['✅ Servis uspešno shranjen!', '✅ Service saved successfully!'],
  ['✅ Strošek uspešno shranjen!', '✅ Expense saved successfully!'],
  ['Slika računa', 'Receipt photo'],
  ['Dodaj/slikaj račun', 'Add/take receipt photo'],
  ['Skeniraj/preberi račun', 'Scan/read receipt'],
  ['AI branje računov je trenutno v internem testiranju. Javni zagon je planiran v letu 2027.', 'AI receipt reading is currently in internal testing. Public launch is planned for 2027.'],
  ['Najprej dodaj ali slikaj račun.', 'First add or take a receipt photo.'],
  ['Če avtomatsko branje ni podprto, prilepi tekst računa sem...', 'If automatic reading is not supported, paste receipt text here...'],
  ['Podatki so prebrani. Pred shranjevanjem jih še enkrat preveri.', 'Data was read. Check it once more before saving.'],
  ['Napaka pri nalaganju slike: ', 'Error uploading image: '],
  ['Napaka pri nalaganju slike racuna: ', 'Error uploading receipt image: '],
  ['Napaka pri nalaganju slike', 'Image upload error'],
  ['Postaja (po želji)', 'Station (optional)'],
  ['Ime servisa (po želji)', 'Service name (optional)'],
  ['npr. OMV Ljubljana', 'e.g. OMV Ljubljana'],
  ['npr. Menjava olja + filter', 'e.g. Oil and filter change'],
  ['npr. Volvo Center Ljubljana', 'e.g. Volvo Center Ljubljana'],
  ['npr. 320', 'e.g. 320'],
  ['Slika stevca (za Photo/Strong verified)', 'Odometer photo (for Photo/Strong verified)'],
  ['Slika števca', 'Odometer photo'],
  ['Dodaj/slikaj stevec kilometrov', 'Add/take odometer photo'],
  ['Dodaj/slikaj števec kilometrov', 'Add/take odometer photo'],
  ['Odstrani sliko stevca', 'Remove odometer photo'],
  ['Odstrani sliko števca', 'Remove odometer photo'],
  ['Števec + račun', 'Odometer + receipt'],
  ['Slike računov (največ 3, max 2MB vsaka)', 'Receipt photos (maximum 3, max 2MB each)'],
  ['Dodaj sliko računa', 'Add receipt photo'],
  ['Če vneseš interval, aplikacija sama ustvari opomnik.', 'If you enter an interval, the app creates a reminder automatically.'],
  ['Čez km', 'After km'],
  ['Čez dni', 'After days'],
  ['Preveri kilometre in podatke pred shranjevanjem', 'Check mileage and details before saving'],
  ['Servisni zapis lahko popravis samo prvih 24 ur. Po tem se Basic, Photo verified in Strong verified zapis zaklene, zato se enkrat preveri datum, kilometre, opis dela, racun in sliko stevca.', 'A service record can only be edited for the first 24 hours. After that, Basic, Photo verified and Strong verified records are locked, so check the date, mileage, work description, receipt and odometer photo once more.'],
  ['Nalaganje slik...', 'Uploading photos...'],
  ['Shrani servis →', 'Save service →'],
  ['Shrani tankanje →', 'Save fill-up →'],
  ['Shrani strošek →', 'Save expense →'],
  ['npr. Pranje avta, Parking...', 'e.g. Car wash, parking...'],
  ['npr. 150', 'e.g. 150'],
  ['npr. Letna registracija 2026...', 'e.g. Annual registration 2026...'],
  ['Uvoz iz drugih app', 'Import from other apps'],
  ['Scan računov', 'Receipt scan'],
  ['Scan racunov', 'Receipt scan'],
  ['Racun', 'Receipt'],
  ['Račun', 'Receipt'],
  ['Vse', 'All'],
  ['Napaka: ', 'Error: '],
  ['npr. 52.4', 'e.g. 52.4'],
  ['npr. 1.489', 'e.g. 1.489'],
  ['Poročila', 'Reports'],
  ['GarageBase aplikacija na računalniku, tablici in telefonu', 'GarageBase app on desktop, tablet and phone'],
  ['Za biometrijo mora biti seja še aktivna. Najprej se enkrat prijavi z geslom.', 'For biometric sign-in, your session must still be active. Sign in with your password once first.'],
  ['Biometrična prijava ni uspela. Poskusi znova ali uporabi geslo.', 'Biometric sign-in failed. Try again or use your password.'],
  ['Novo geslo mora imeti vsaj 6 znakov.', 'The new password must have at least 6 characters.'],
  ['Za registracijo se moraš strinjati s pogoji uporabe in politiko zasebnosti.', 'To register, you must accept the terms of use and privacy policy.'],
  ['Vnesi osnovne podatke, sliko in kilometre.', 'Enter basic details, a photo and mileage.'],
  ['Odpri Dodaj avto.', 'Open Add vehicle.'],
  ['Vnesi znamko, model, letnik in trenutne kilometre.', 'Enter make, model, year and current mileage.'],
  ['Dodaj sliko, ker bo vozilo lazje prepoznavno v garazi in reportu.', 'Add a photo so the vehicle is easier to recognize in the garage and report.'],
  ['Vnesi tankanje', 'Enter a fill-up'],
  ['Vnesi km, litre, ceno in po zelji sliko racuna.', 'Enter mileage, liters, price and optionally a receipt photo.'],
  ['Najprej izberi vozilo.', 'Select a vehicle first.'],
  ['Vnesi servis', 'Enter a service'],
  ['Shrani servis, racune in samodejno ustvari naslednji opomnik.', 'Save the service, receipts and automatically create the next reminder.'],
  ['Izberi vozilo in vnesi datum ter kilometre.', 'Select a vehicle and enter the date and mileage.'],
  ['Ce ves naslednji interval, vnesi km ali dni in app ustvari opomnik.', 'If you know the next interval, enter mileage or days and the app creates a reminder.'],
  ['Dodaj strosek', 'Add an expense'],
  ['Dodaj znesek, datum in po potrebi sliko racuna.', 'Add the amount, date and receipt photo if needed.'],
  ['Slika se shrani pri vnosu in je kasneje vidna v zgodovini ter reportu.', 'The photo is saved with the entry and is later visible in history and the report.'],
  ['Slikaj racun cim bolj naravnost in z dovolj svetlobe.', 'Take the receipt photo as straight as possible with enough light.'],
  ['Report lahko vsebuje QR za branje, uvoz zgodovine, sliko vozila in racune.', 'The report can include a QR for reading, history import, vehicle photo and receipts.'],
  ['Odpri vozilo in klikni Report.', 'Open the vehicle and tap Report.'],
  ['Obkljukaj Samo za branje, Izvoz zgodovine, Sliko vozila in Slike racunov po potrebi.', 'Select Read only, History export, Vehicle photo and Receipt photos as needed.'],
  ['Nacin uporabe lahko vedno spremenis v nastavitvah.', 'You can always change usage mode in settings.'],
  ['Full prikaze vse zgodovine, grafe, report in napredne nastavitve.', 'Full shows all histories, charts, report and advanced settings.'],
  ['Odpri Nastavitve.', 'Open Settings.'],
  ['Npr. rad bi izvozil PDF, skeniral racun, prenesel avto novemu lastniku...', 'E.g. I want to export a PDF, scan a receipt, transfer a vehicle to the next owner...'],
  ['Najprej dodaj vozilo', 'Add a vehicle first'],
  ['Nekatere funkcije potrebujejo izbrano vozilo. Ko dodas prvi avto, te bo pomocnik vodil direktno do pravih vnosov.', 'Some features need a selected vehicle. Once you add your first vehicle, the assistant will guide you directly to the right entries.'],
  ['Odpri', 'Open'],
  ['Ce pomocnik ne odgovori dovolj dobro, poslji predlog in ga vidimo v adminu.', 'If the assistant does not answer well enough, send a suggestion and we will see it in admin.'],
  ['Lastnik mora v nastavitvah vozila najprej dovoliti prenos zgodovine.', 'The owner must first allow history transfer in vehicle settings.'],
  ['Koda ni veljavna ali nima soglasja za prenos.', 'The code is invalid or does not have transfer consent.'],
  ['QR koda za prenos', 'Transfer QR code'],
  ['Preklicem vse aktivne QR kode za to vozilo? Stari PDF bo se vedno obstajal, QR kode pa ne bodo vec delovale.', 'Cancel all active QR codes for this vehicle? The old PDF will still exist, but the QR codes will no longer work.'],
  ['QR BRANJE: skeniraj za digitalni report iz GarageBase baze. Podatke primerjaj s PDF dokumentom. QR velja 30 dni.', 'QR READ: scan for the digital report from the GarageBase database. Compare the data with the PDF document. QR is valid for 30 days.'],
  ['QR UVOZ ZGODOVINE: skeniraj za uvoz vozila in zgodovine v novo GarageBase garazo. Pred uvozom se prikaze potrditev. QR velja 30 dni.', 'QR HISTORY IMPORT: scan to import the vehicle and history into a new GarageBase garage. Confirmation is shown before import. QR is valid for 30 days.'],
  ['Prikaži tablico', 'Show license plate'],
  ['Prikaži VIN', 'Show VIN'],
  ['Prikaži kilometre', 'Show mileage'],
  ['Prikaži gorivo', 'Show fuel'],
  ['Prikaži letnik', 'Show year'],
  ['Prikaži mesto lastnika', 'Show owner city'],
  ['Prikaži starost lastnika', 'Show owner age'],
  ['Slike ni bilo mogoce pripraviti.', 'The image could not be prepared.'],
  ['Slike homologacije ni bilo mogoce pripraviti.', 'The homologation image could not be prepared.'],
  ['Napaka pri nalaganju homologacije.', 'Error uploading homologation.'],
  ['✅ Slika uspešno naložena!', '✅ Photo uploaded successfully!'],
  ['✅ Homologacija uspešno naložena!', '✅ Homologation uploaded successfully!'],
  ['npr. e1*2007/46*1234', 'e.g. e1*2007/46*1234'],
  ['npr. Vpisane pnevmatike, platišča, vlečna kljuka...', 'e.g. Registered tires, rims, tow bar...'],
  ['npr. Ljubljana', 'e.g. Ljubljana'],
  ['Shrani spremembe →', 'Save changes →'],
]

const slToEn = new Map<string, string>()
for (const [sl, en] of [...phrasePairs, ...extraPhrasePairs]) {
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
    return '⚠️ Backdated entry - the actual entry time will be recorded'
  }

  if (clean.startsWith('⚠️ Naknadno vnešen servis')) {
    return clean.replace('Naknadno vnešen servis', 'Backdated service entry').replace('zabeležen datum vnosa', 'entry date recorded')
  }

  if (clean.startsWith('Napaka: ')) return clean.replace('Napaka:', 'Error:')
  if (clean.startsWith('npr. ')) return clean.replace(/^npr\./i, 'e.g.')
  if (clean.startsWith('Nisem razumel:')) return clean.replace('Nisem razumel:', 'I did not understand:').replace('Poskusi znova.', 'Try again.')
  if (clean.startsWith('Km ne smejo biti nižji od')) return clean.replace('Km ne smejo biti nižji od', 'Mileage cannot be lower than')
  if (clean.startsWith('Km ne smejo biti nizji od')) return clean.replace('Km ne smejo biti nizji od', 'Mileage cannot be lower than')
  if (clean.startsWith('Napaka pri nalaganju slike:')) return clean.replace('Napaka pri nalaganju slike:', 'Error uploading image:')
  if (clean.startsWith('Nastavitev obvestil ni bilo mogoce shraniti:')) return clean.replace('Nastavitev obvestil ni bilo mogoce shraniti:', 'Notification settings could not be saved:')
  if (clean.startsWith('Test obvestila ni uspel:')) return clean.replace('Test obvestila ni uspel:', 'Notification test failed:')
  if (clean.startsWith('Test iz baze ni uspel:')) return clean.replace('Test iz baze ni uspel:', 'Database test failed:')
  if (clean.startsWith('Test opomnikov ni uspel:')) return clean.replace('Test opomnikov ni uspel:', 'Reminder test failed:')

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
