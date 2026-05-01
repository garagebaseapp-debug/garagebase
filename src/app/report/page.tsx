'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { createTransferToken, scanUrl, transferExpiresAt } from '@/lib/transfer'
import { getStoredLanguage, type Language } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics'
import QRCode from 'qrcode'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 30, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: '#6c63ff',
  },
  headerLeft: { flex: 1 },
  appName: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  appSubtitle: { fontSize: 10, color: '#888888', marginTop: 4 },
  carTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111111', marginBottom: 4 },
  carInfo: { fontSize: 9, color: '#555555', marginBottom: 2 },
  reportDate: { fontSize: 8, color: '#888888', marginTop: 4 },
  badge: { backgroundColor: '#6c63ff', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#6c63ff', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: '#f8f8ff', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  statLabel: { fontSize: 7, color: '#888888', marginBottom: 2 },
  statValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111111' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#ebebff', padding: 6, borderRadius: 4, marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  // Servisna knjiga stolpci
  sDate: { width: '13%', fontSize: 8, color: '#333333' },
  sKm: { width: '13%', fontSize: 8, color: '#333333' },
  sOpis: { width: '44%', fontSize: 8, color: '#333333' },
  sCena: { width: '15%', fontSize: 8, color: '#333333', textAlign: 'right' },
  sRacun: { width: '8%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  sTrust: { width: '7%', fontSize: 7, color: '#16a34a', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  sDateH: { width: '13%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sKmH: { width: '13%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sOpisH: { width: '44%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sCenaH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  sRacunH: { width: '8%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  sTrustH: { width: '7%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  // Gorivo stolpci
  gDate: { width: '14%', fontSize: 8, color: '#333333' },
  gKm: { width: '14%', fontSize: 8, color: '#333333' },
  gOpis: { width: '32%', fontSize: 8, color: '#333333' },
gTip95: { width: '9%', fontSize: 8, color: '#16a34a', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTip100: { width: '9%', fontSize: 8, color: '#2563eb', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTipD: { width: '9%', fontSize: 8, color: '#888888', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTipH: { width: '9%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
gOpisH: { width: '32%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gCena: { width: '17%', fontSize: 8, color: '#333333', textAlign: 'right' },
  gRacun: { width: '7%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  gTrust: { width: '7%', fontSize: 7, color: '#16a34a', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  gDateH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gKmH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gCenaH: { width: '17%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  gRacunH: { width: '7%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  gTrustH: { width: '7%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  // Expenses stolpci
  eDate: { width: '15%', fontSize: 8, color: '#333333' },
  eKat: { width: '18%', fontSize: 8, color: '#333333' },
  eOpis: { width: '37%', fontSize: 8, color: '#333333' },
  eCena: { width: '16%', fontSize: 8, color: '#333333', textAlign: 'right' },
  eRacun: { width: '7%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  eTrust: { width: '7%', fontSize: 7, color: '#16a34a', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  eDateH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eKatH: { width: '18%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eOpisH: { width: '37%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eCenaH: { width: '16%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  eRacunH: { width: '7%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  eTrustH: { width: '7%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  opomba: { fontSize: 8, color: '#5555cc', marginTop: 8, padding: 8, backgroundColor: '#f0f0ff', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#6c63ff' },
  ownerDivider: { marginVertical: 7, paddingVertical: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#6c63ff', backgroundColor: '#f8f8ff' },
  ownerDividerText: { fontSize: 8, color: '#6c63ff', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  qrBox: { marginTop: 10, padding: 8, borderWidth: 1, borderColor: '#e0e0ff', borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrImage: { width: 72, height: 72 },
  carPhoto: { width: 110, height: 72, objectFit: 'cover', borderRadius: 6, borderWidth: 1, borderColor: '#e0e0ff' },
  qrText: { flex: 1, fontSize: 8, color: '#555555', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#aaaaaa' },
})

const maskVin = (vin?: string) => {
  if (!vin) return ''
  if (vin.length <= 8) return vin.substring(0, 3) + '****'
  return vin.substring(0, 6) + '****' + vin.substring(vin.length - 4)
}

const maskPlate = (plate?: string) => {
  if (!plate) return ''
  const clean = plate.toUpperCase()
  if (clean.length <= 4) return clean.substring(0, 1) + '***'
  return clean.substring(0, 2) + ' *** ' + clean.substring(clean.length - 2)
}

const pdfCopy = {
  sl: {
    subtitle: 'Servisna knjiga in evidenca vozila',
    badge: 'VERIFICIRAN REPORT',
    year: 'Letnik',
    plate: 'Tablica',
    fuel: 'Gorivo',
    currentKm: 'Trenutni km',
    generated: 'Generirano',
    costOverview: 'Pregled stroskov',
    totalCosts: 'SKUPAJ STROSKI',
    services: 'SERVISI',
    other: 'OSTALO',
    totalLiters: 'SKUPAJ LITROV',
    serviceCount: 'ST. SERVISOV',
    fuelCount: 'ST. TANKANIJ',
    ownership: 'Lastnistvo in prenos',
    owners: 'ST. LASTNIKOV',
    ownerCity: 'MESTO LASTNIKA',
    ownerAge: 'STAROST LASTNIKA',
    transferConsent: 'SOGLASJE PRENOSA',
    homologation: 'Homologacija',
    homologationNumber: 'STEVILKA HOMOLOGACIJE',
    homologationDescription: 'OPIS HOMOLOGACIJE',
    homologationDocument: 'DOKUMENT',
    attached: 'PRILOZENO',
    yes: 'DA',
    no: 'NE',
    transferredNote: 'Zapisi oznaceni z [Prejsnji lastnik] so prenesena zgodovina. Novi vnosi trenutnega lastnika so brez te oznake.',
    qrRead: 'QR BRANJE: skeniraj za digitalni report iz GarageBase baze. Podatke primerjaj s PDF dokumentom. QR velja 30 dni.',
    qrImport: 'QR UVOZ ZGODOVINE: skeniraj za uvoz vozila in zgodovine v novo GarageBase garazo. Pred uvozom se prikaze potrditev. QR velja 30 dni.',
    serviceBook: 'Servisna knjiga',
    date: 'Datum',
    km: 'Km',
    work: 'Opis dela',
    price: 'Cena',
    receipt: 'Racun',
    trust: 'Zaupanje',
    trustBasic: 'Basic',
    trustPhoto: 'Photo',
    trustStrong: 'Strong',
    trustNote: 'Stopnje zaupanja: Basic = rocni vnos, Photo = vnos s sliko stevca, Strong = slika stevca + uradni dokument + casovni zig + zaklenjen zapis. GarageBase potrjuje transparentno zgodovino od trenutka uporabe aplikacije naprej.',
    receiptsNote: '[ DA ] = Slike racunov so prilozene v GarageBase aplikaciji. Za ogled originalnih racunov zahtevajte dostop pri prodajalcu vozila ali obiscite getgaragebase.com',
    fuelLog: 'Evidenca goriva',
    type: 'Tip',
    litersStation: 'Litri - Postaja',
    extraCosts: 'Dodatni stroski',
    category: 'Kategorija',
    description: 'Opis',
    amount: 'Znesek',
  },
  en: {
    subtitle: 'Service book and vehicle record',
    badge: 'VERIFIED REPORT',
    year: 'Year',
    plate: 'Plate',
    fuel: 'Fuel',
    currentKm: 'Current mileage',
    generated: 'Generated',
    costOverview: 'Cost overview',
    totalCosts: 'TOTAL COSTS',
    services: 'SERVICES',
    other: 'OTHER',
    totalLiters: 'TOTAL LITERS',
    serviceCount: 'NO. OF SERVICES',
    fuelCount: 'NO. OF FILL-UPS',
    ownership: 'Ownership and transfer',
    owners: 'NO. OF OWNERS',
    ownerCity: 'OWNER CITY',
    ownerAge: 'OWNER AGE',
    transferConsent: 'TRANSFER CONSENT',
    homologation: 'Homologation',
    homologationNumber: 'HOMOLOGATION NUMBER',
    homologationDescription: 'HOMOLOGATION DESCRIPTION',
    homologationDocument: 'DOCUMENT',
    attached: 'ATTACHED',
    yes: 'YES',
    no: 'NO',
    transferredNote: 'Records marked with [Previous owner] are transferred history. New records from the current owner are not marked.',
    qrRead: 'QR READ: scan for the digital report from the GarageBase database. Compare the data with the PDF document. QR is valid for 30 days.',
    qrImport: 'QR HISTORY IMPORT: scan to import the vehicle and history into a new GarageBase garage. Confirmation is shown before import. QR is valid for 30 days.',
    serviceBook: 'Service book',
    date: 'Date',
    km: 'Km',
    work: 'Work performed',
    price: 'Price',
    receipt: 'Receipt',
    trust: 'Trust',
    trustBasic: 'Basic',
    trustPhoto: 'Photo',
    trustStrong: 'Strong',
    trustNote: 'Trust levels: Basic = manual entry, Photo = odometer photo, Strong = odometer photo + official document + timestamp + locked record. GarageBase verifies transparent history from the moment the app is used onward.',
    receiptsNote: '[ YES ] = Receipt photos are attached in the GarageBase app. Ask the vehicle seller for access to view original receipts or visit getgaragebase.com',
    fuelLog: 'Fuel log',
    type: 'Type',
    litersStation: 'Liters - Station',
    extraCosts: 'Additional costs',
    category: 'Category',
    description: 'Description',
    amount: 'Amount',
  },
} as const

const ReportPDF = ({ avto, servisi, gorivo, expenses, verifyQr, importQr, includeVehicleImage, language = 'sl', privacy = {} }: any) => {
  const copy = pdfCopy[language as Language] || pdfCopy.sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'
  const skupajGorivo = gorivo.reduce((s: number, v: any) => s + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((s: number, v: any) => s + (v.cena || 0), 0)
  const skupajExpenses = expenses.reduce((s: number, v: any) => s + (v.znesek || 0), 0)
  const skupajVse = skupajGorivo + skupajServis + skupajExpenses
  const skupajLitrov = gorivo.reduce((s: number, v: any) => s + (v.litri || 0), 0)
  const danes = new Date().toLocaleDateString(locale)
  const imaPrivonke = servisi.some((s: any) => s.foto_url) || gorivo.some((g: any) => g.receipt_url) || expenses.some((e: any) => e.receipt_url)
  const imaPrenesene = servisi.some((v: any) => v.opis?.includes('[Prejsnji lastnik]')) || gorivo.some((v: any) => v.postaja?.includes('[Prejsnji lastnik]')) || expenses.some((v: any) => v.opis?.includes('[Prejsnji lastnik]'))
  const trustLabel = (row: any) => {
    if (row.verification_level === 'strong') return copy.trustStrong
    if (row.verification_level === 'photo') return copy.trustPhoto
    return copy.trustBasic
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>GarageBase</Text>
            <Text style={styles.appSubtitle}>{copy.subtitle}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{copy.badge}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {includeVehicleImage && avto.slika_url && <Image src={avto.slika_url} style={styles.carPhoto} />}
            <Text style={[styles.carTitle, { marginTop: includeVehicleImage && avto.slika_url ? 8 : 0 }]}>
              {avto.znamka?.charAt(0).toUpperCase() + avto.znamka?.slice(1)} {avto.model?.toUpperCase()}
            </Text>
            {privacy.showYear !== false && avto.letnik && <Text style={styles.carInfo}>{copy.year}: {avto.letnik}</Text>}
            {privacy.showPlate !== false && avto.tablica && <Text style={styles.carInfo}>{copy.plate}: {privacy.maskPlate === false ? avto.tablica.toUpperCase() : maskPlate(avto.tablica)}</Text>}
            {privacy.showVin !== false && avto.vin && <Text style={styles.carInfo}>VIN: {privacy.maskVin === false ? avto.vin : maskVin(avto.vin)}</Text>}
            {privacy.showFuel !== false && avto.gorivo && <Text style={styles.carInfo}>{copy.fuel}: {avto.gorivo}</Text>}
            {privacy.showKm !== false && avto.km_trenutni && <Text style={styles.carInfo}>{copy.currentKm}: {avto.km_trenutni.toLocaleString()} km</Text>}
            <Text style={styles.reportDate}>{copy.generated}: {danes}</Text>
          </View>
        </View>

        {/* Statistike */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.costOverview}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.totalCosts}</Text>
              <Text style={styles.statValue}>{skupajVse.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.fuel.toUpperCase()}</Text>
              <Text style={styles.statValue}>{skupajGorivo.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.services}</Text>
              <Text style={styles.statValue}>{skupajServis.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.other}</Text>
              <Text style={styles.statValue}>{skupajExpenses.toFixed(2)} EUR</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.totalLiters}</Text>
              <Text style={styles.statValue}>{skupajLitrov.toFixed(0)} L</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.serviceCount}</Text>
              <Text style={styles.statValue}>{servisi.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.fuelCount}</Text>
              <Text style={styles.statValue}>{gorivo.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.currentKm.toUpperCase()}</Text>
              <Text style={styles.statValue}>{privacy.showKm !== false ? (avto.km_trenutni?.toLocaleString() || '-') : '-'}</Text>
            </View>
          </View>
        </View>


        {/* Lastnistvo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.ownership}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.owners}</Text>
              <Text style={styles.statValue}>{avto.st_lastnikov || '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.ownerCity}</Text>
              <Text style={styles.statValue}>{privacy.showOwnerCity !== false ? (avto.lastnik_mesto || '-') : '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.ownerAge}</Text>
              <Text style={styles.statValue}>{privacy.showOwnerAge !== false ? (avto.lastnik_starost || '-') : '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.transferConsent}</Text>
              <Text style={styles.statValue}>{avto.prenos_soglasje ? copy.yes : copy.no}</Text>
            </View>
          </View>
          {avto.prenos_opomba && <Text style={styles.opomba}>{avto.prenos_opomba}</Text>}
          {imaPrenesene && <Text style={styles.opomba}>{copy.transferredNote}</Text>}
          {verifyQr && (
            <View style={styles.qrBox}>
              <Image src={verifyQr} style={styles.qrImage} />
              <Text style={styles.qrText}>{copy.qrRead}</Text>
            </View>
          )}
          {importQr && (
            <View style={styles.qrBox}>
              <Image src={importQr} style={styles.qrImage} />
              <Text style={styles.qrText}>{copy.qrImport}</Text>
            </View>
          )}
        </View>
        {(avto.homologacija_stevilka || avto.homologacija_opis || avto.homologacija_url) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.homologation}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{copy.homologationNumber}</Text>
                <Text style={styles.statValue}>{avto.homologacija_stevilka || '-'}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>{copy.homologationDocument}</Text>
                <Text style={styles.statValue}>{avto.homologacija_url ? copy.attached : '-'}</Text>
              </View>
            </View>
            {avto.homologacija_opis && (
              <Text style={styles.opomba}>{copy.homologationDescription}: {avto.homologacija_opis}</Text>
            )}
          </View>
        )}
        {/* Servisna knjiga */}
        {servisi.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.serviceBook}</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.sDateH}>{copy.date}</Text>
              <Text style={styles.sKmH}>{copy.km}</Text>
              <Text style={styles.sOpisH}>{copy.work}</Text>
              <Text style={styles.sCenaH}>{copy.price}</Text>
              <Text style={styles.sRacunH}>{copy.receipt}</Text>
              <Text style={styles.sTrustH}>{copy.trust}</Text>
            </View>
            {servisi.map((s: any, i: number) => (
              <View key={s.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.sDate}>{new Date(s.datum).toLocaleDateString(locale)}</Text>
                <Text style={styles.sKm}>{s.km?.toLocaleString()}</Text>
                <Text style={styles.sOpis}>{s.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 55)}{s.servis ? ` (${s.servis})` : ''}</Text>
                <Text style={styles.sCena}>{s.cena ? `${s.cena.toFixed(2)} EUR` : '-'}</Text>
                <Text style={styles.sRacun}>{s.foto_url ? `[ ${copy.yes} ]` : '-'}</Text>
                <Text style={styles.sTrust}>{trustLabel(s)}</Text>
              </View>
            ))}
            {imaPrivonke && (
              <Text style={styles.opomba}>
                {copy.receiptsNote}
              </Text>
            )}
            <Text style={styles.opomba}>{copy.trustNote}</Text>
          </View>
        )}

        {/* Gorivo */}
        {gorivo.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.fuelLog}</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.gDateH}>{copy.date}</Text>
              <Text style={styles.gKmH}>{copy.km}</Text>
              <Text style={styles.gTipH}>{copy.type}</Text>
              <Text style={styles.gOpisH}>{copy.litersStation}</Text>
              <Text style={styles.gCenaH}>{copy.price}</Text>
              <Text style={styles.gRacunH}>{copy.receipt}</Text>
              <Text style={styles.gTrustH}>{copy.trust}</Text>
            </View>
            {gorivo.map((g: any, i: number) => (
              <View key={g.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.gDate}>{new Date(g.datum).toLocaleDateString(locale)}</Text>
                <Text style={styles.gKm}>{g.km?.toLocaleString()}</Text>
                <Text style={g.tip_goriva === '95' ? styles.gTip95 : g.tip_goriva === '100' ? styles.gTip100 : styles.gTipD}>
  {g.tip_goriva === '95' ? '95' : g.tip_goriva === '100' ? '100' : g.tip_goriva === 'diesel' ? 'D' : '-'}
</Text>
                <Text style={styles.gOpis}>{g.litri} L{g.postaja ? ` - ${g.postaja}` : ''}</Text>
                <Text style={styles.gCena}>{g.cena_skupaj ? `${g.cena_skupaj.toFixed(2)} EUR` : '-'}</Text>
                <Text style={styles.gRacun}>{g.receipt_url ? `[ ${copy.yes} ]` : '-'}</Text>
                <Text style={styles.gTrust}>{trustLabel(g)}</Text>
              </View>
            ))}
            <Text style={styles.opomba}>{copy.trustNote}</Text>
          </View>
        )}

        {/* Dodatni stroski */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.extraCosts}</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.eDateH}>{copy.date}</Text>
              <Text style={styles.eKatH}>{copy.category}</Text>
              <Text style={styles.eOpisH}>{copy.description}</Text>
              <Text style={styles.eCenaH}>{copy.amount}</Text>
              <Text style={styles.eRacunH}>{copy.receipt}</Text>
              <Text style={styles.eTrustH}>{copy.trust}</Text>
            </View>
            {expenses.map((e: any, i: number) => (
              <View key={e.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.eDate}>{new Date(e.datum).toLocaleDateString(locale)}</Text>
                <Text style={styles.eKat}>{e.kategorija}</Text>
                <Text style={styles.eOpis}>{String(e.opis || '-').replace('[Prejsnji lastnik]', '[PREJSNJI]')}</Text>
                <Text style={styles.eCena}>{e.znesek?.toFixed(2)} EUR</Text>
                <Text style={styles.eRacun}>{e.receipt_url ? `[ ${copy.yes} ]` : '-'}</Text>
                <Text style={styles.eTrust}>{trustLabel(e)}</Text>
              </View>
            ))}
            <Text style={styles.opomba}>{copy.trustNote}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GarageBase - getgaragebase.com</Text>
          <Text style={styles.footerText}>{copy.generated}: {danes}</Text>
        </View>

      </Page>
    </Document>
  )
}

export default function Report() {
  const [avto, setAvto] = useState<any>(null)
  const [servisi, setServisi] = useState<any[]>([])
  const [gorivo, setGorivo] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [verifyQr, setVerifyQr] = useState('')
  const [importQr, setImportQr] = useState('')
  const [includeVerifyQr, setIncludeVerifyQr] = useState(true)
  const [includeImportQr, setIncludeImportQr] = useState(false)
  const [includeVehicleImage, setIncludeVehicleImage] = useState(true)
  const [includeReceiptImages, setIncludeReceiptImages] = useState(false)
  const [includeServices, setIncludeServices] = useState(true)
  const [includeFuel, setIncludeFuel] = useState(false)
  const [includeExpenses, setIncludeExpenses] = useState(true)
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<string[]>([])
  const [language, setLanguage] = useState<Language>('sl')
  const [privacy, setPrivacy] = useState({
    showPlate: true,
    maskPlate: true,
    showVin: true,
    maskVin: true,
    showKm: true,
    showFuel: true,
    showYear: true,
    showOwnerCity: true,
    showOwnerAge: true,
  })


  const pripraviQrKode = async (carId: string, userId: string, avtoData: any, servisData: any[], gorivoData: any[], filteredExpenses: any[], reportLanguage: Language) => {
    const carSummary = {
      znamka: avtoData?.znamka,
      model: avtoData?.model,
      letnik: avtoData?.letnik,
      gorivo: avtoData?.gorivo,
      vin_masked: maskVin(avtoData?.vin),
      tablica_masked: maskPlate(avtoData?.tablica),
      km_trenutni: avtoData?.km_trenutni,
      st_lastnikov: avtoData?.st_lastnikov,
      lastnik_mesto: avtoData?.lastnik_mesto,
      lastnik_starost: avtoData?.lastnik_starost,
      homologacija_stevilka: avtoData?.homologacija_stevilka,
      homologacija_opis: avtoData?.homologacija_opis,
      homologacija_url: avtoData?.homologacija_url,
      servisi: servisData?.length || 0,
      tankanja: gorivoData?.length || 0,
      stroski: filteredExpenses.length,
    }
    const carFull = {
      tip_vozila: avtoData?.tip_vozila,
      oblika: avtoData?.oblika,
      znamka: avtoData?.znamka,
      model: avtoData?.model,
      letnik: avtoData?.letnik,
      gorivo: avtoData?.gorivo,
      barva: avtoData?.barva,
      tablica: privacy.showPlate ? (privacy.maskPlate ? maskPlate(avtoData?.tablica) : avtoData?.tablica) : null,
      vin: privacy.showVin ? (privacy.maskVin ? maskVin(avtoData?.vin) : avtoData?.vin) : null,
      km_trenutni: avtoData?.km_trenutni,
      km_ob_vnosu: avtoData?.km_ob_vnosu,
      kubikaza: avtoData?.kubikaza,
      kw: avtoData?.kw,
      menjalnik: avtoData?.menjalnik,
      pogon: avtoData?.pogon,
      st_lastnikov: avtoData?.st_lastnikov,
      lastnik_mesto: avtoData?.lastnik_mesto,
      lastnik_starost: avtoData?.lastnik_starost,
      homologacija_stevilka: avtoData?.homologacija_stevilka,
      homologacija_opis: avtoData?.homologacija_opis,
      homologacija_url: avtoData?.homologacija_url,
      slika_url: includeVehicleImage ? avtoData?.slika_url : null,
    }
    const servisForTransfer = includeReceiptImages ? (servisData || []) : (servisData || []).map(({ foto_url, ...row }: any) => row)
    const gorivoForTransfer = includeReceiptImages ? (gorivoData || []) : (gorivoData || []).map(({ receipt_url, ...row }: any) => row)
    const expensesForTransfer = includeReceiptImages ? (filteredExpenses || []) : (filteredExpenses || []).map(({ receipt_url, ...row }: any) => row)
    const withSourceIds = (rows: any[]) => rows.map((row: any) => ({
      ...row,
      source_entry_id: row.source_entry_id || row.id,
      verification_level: row.verification_level || 'basic',
    }))
    const makePayload = (mode: 'verify' | 'import', token: string) => ({
      type: 'garagebase-transfer-v1',
      mode,
      transfer_token: token,
      language: reportLanguage,
      exportedAt: new Date().toISOString(),
      consent: true,
      car: carSummary,
      car_full: carFull,
      include_vehicle_image: includeVehicleImage,
      include_receipt_images: includeReceiptImages,
      privacy,
      service_logs: withSourceIds(servisForTransfer),
      fuel_logs: withSourceIds(gorivoForTransfer),
      expenses: withSourceIds(expensesForTransfer),
    })

    setVerifyQr('')
    setImportQr('')
    if (includeVerifyQr) {
      const token = createTransferToken()
      await supabase.from('vehicle_transfers').insert({ token, car_id: carId, created_by: userId, mode: 'verify', consent: true, payload: makePayload('verify', token), expires_at: transferExpiresAt(30) })
      setVerifyQr(await QRCode.toDataURL(scanUrl(token), { width: 180, margin: 1 }))
    }
    if (includeImportQr) {
      const token = createTransferToken()
      await supabase.from('vehicle_transfers').insert({ token, car_id: carId, created_by: userId, mode: 'import', consent: true, payload: makePayload('import', token), expires_at: transferExpiresAt(30) })
      setImportQr(await QRCode.toDataURL(scanUrl(token), { width: 180, margin: 1 }))
    }
    if (includeImportQr) {
      await supabase.from('cars').update({ history_exported_at: new Date().toISOString() }).eq('id', carId)
    }
  }
  useEffect(() => {
    const init = async () => {
      const currentLanguage = getStoredLanguage()
      setLanguage(currentLanguage)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }
      trackEvent('report_open', { carId })

      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: servisData } = await supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setServisi(servisData || [])
      const { data: gorivoData } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setGorivo(gorivoData || [])
      const { data: expensesData } = await supabase.from('expenses').select('*').eq('car_id', carId).order('datum', { ascending: true })
      const filteredExpenses = (expensesData || []).filter((e: any) => e.kategorija !== 'km_sprememba')
      setExpenses(filteredExpenses)
      setSelectedExpenseCategories(prev => prev.length > 0 ? prev : [...new Set(filteredExpenses.map((e: any) => e.kategorija || 'ostalo'))] as string[])

      try {
        await pripraviQrKode(
          carId,
          user.id,
          avtoData,
          includeServices ? (servisData || []) : [],
          includeFuel ? (gorivoData || []) : [],
          includeExpenses ? filteredExpenses.filter((e: any) => selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(e.kategorija || 'ostalo')) : [],
          currentLanguage
        )
      } catch {
        setVerifyQr('')
        setImportQr('')
      }

      setLoading(false)
      setTimeout(() => setReady(true), 500)
    }
    init()
  }, [includeVerifyQr, includeImportQr, includeVehicleImage, includeReceiptImages, includeServices, includeFuel, includeExpenses, selectedExpenseCategories.join('|'), JSON.stringify(privacy)])

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{language === 'en' ? 'Loading data...' : 'Nalaganje podatkov...'}</p>
    </div>
  )

  const expenseCategories = [...new Set(expenses.map((e: any) => e.kategorija || 'ostalo'))] as string[]
  const expensesForReport = includeExpenses
    ? expenses.filter((e: any) => selectedExpenseCategories.length === 0 || selectedExpenseCategories.includes(e.kategorija || 'ostalo'))
    : []
  const servisiForReport = includeServices ? servisi : []
  const gorivoForReport = includeFuel ? gorivo : []
  const totalForReport = servisiForReport.reduce((s, v) => s + (v.cena || 0), 0) +
    gorivoForReport.reduce((s, v) => s + (v.cena_skupaj || 0), 0) +
    expensesForReport.reduce((s, v) => s + (v.znesek || 0), 0)
  const tx = (sl: string, en: string) => language === 'en' ? en : sl

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">📄 {tx('PDF Report', 'PDF Report')}</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Vsebina reporta', 'Report content')}</p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">🔧 {tx('Servisov', 'Services')}</span>
            <span className="text-[#6c63ff] font-bold">{servisi.length}</span>
          </div>
          <button onClick={() => setIncludeServices(!includeServices)}
            className={`rounded-xl border px-3 py-2 text-left ${includeServices ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeServices ? '[x]' : '[ ]'} {tx('Servisi', 'Services')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Servisna knjiga', 'Service book')}: {servisi.length} {tx('zapisov', 'records')}</p>
          </button>
          <button onClick={() => setIncludeFuel(!includeFuel)}
            className={`rounded-xl border px-3 py-2 text-left ${includeFuel ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeFuel ? '[x]' : '[ ]'} {tx('Gorivo / tankanja', 'Fuel / fill-ups')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Vkljuci', 'Include')} {gorivo.length} {tx('tankanj samo ce zelis podrobno porocilo.', 'fill-ups only if you want a detailed report.')}</p>
          </button>
          <button onClick={() => setIncludeExpenses(!includeExpenses)}
            className={`rounded-xl border px-3 py-2 text-left ${includeExpenses ? 'bg-[#f59e0b22] border-[#f59e0b66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeExpenses ? '[x]' : '[ ]'} {tx('Dodatni stroski', 'Additional costs')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Izbranih', 'Selected')} {expensesForReport.length} {tx('od', 'of')} {expenses.length} {tx('zapisov.', 'records.')}</p>
          </button>
          {includeExpenses && expenseCategories.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#13131f] border border-[#1e1e32] p-3">
              {expenseCategories.map((category) => {
                const active = selectedExpenseCategories.includes(category)
                return (
                  <button key={category} onClick={() => setSelectedExpenseCategories(active ? selectedExpenseCategories.filter(c => c !== category) : [...selectedExpenseCategories, category])}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${active ? 'border-[#f59e0b66] bg-[#f59e0b22] text-[#f59e0b]' : 'border-[#2a2a40] text-[#7b7ba6]'}`}>
                    {active ? '[x]' : '[ ]'} {category}
                  </button>
                )
              })}
            </div>
          )}
          <div className="hidden">
            <span className="text-white text-sm">⛽ {tx('Tankanij', 'Fill-ups')}</span>
            <span className="text-[#6c63ff] font-bold">{gorivo.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">💰 {tx('Dodatnih stroskov', 'Additional costs')}</span>
            <span className="text-[#6c63ff] font-bold">{expenses.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">📎 {tx('Prilog racunov', 'Receipt attachments')}</span>
            <span className="text-[#6c63ff] font-bold">
              {servisiForReport.filter(s => s.foto_url).length + gorivoForReport.filter(g => g.receipt_url).length + expensesForReport.filter(e => e.receipt_url).length}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-[#1e1e32] pt-2 mt-1">
            <span className="text-white text-sm font-semibold">{tx('Skupaj stroski', 'Total costs')}</span>
            <span className="text-[#3ecfcf] font-bold text-lg">
              {totalForReport.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      {(servisi.some(s => s.foto_url) || gorivo.some(g => g.receipt_url) || expenses.some(e => e.receipt_url)) && (
        <div className="bg-[#6c63ff11] border border-[#6c63ff33] rounded-xl p-4 mb-4">
          <p className="text-[#a09aff] text-xs">
            {tx('To vozilo ima prilozene slike racunov. V PDF reportu so oznacene z [ DA ] - za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com', 'This vehicle has attached receipt photos. In the PDF report they are marked with [ YES ] - ask for access in the GarageBase app to view the original photos at getgaragebase.com')}
          </p>
        </div>
      )}


      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('QR kode v PDF', 'QR codes in PDF')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setIncludeVerifyQr(!includeVerifyQr)}
            className={`rounded-xl border p-4 text-left ${includeVerifyQr ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeVerifyQr ? '[x]' : '[ ]'} {tx('Samo za branje', 'Read only')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('QR za digitalni report.', 'QR for the digital report.')}</p>
          </button>
          <button onClick={() => setIncludeImportQr(!includeImportQr)}
            className={`rounded-xl border p-4 text-left ${includeImportQr ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeImportQr ? '[x]' : '[ ]'} {tx('Izvoz zgodovine', 'History export')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('QR za uvoz vozila.', 'QR for vehicle import.')}</p>
          </button>
          <button onClick={() => setIncludeVehicleImage(!includeVehicleImage)}
            className={`rounded-xl border p-4 text-left ${includeVehicleImage ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeVehicleImage ? '[x]' : '[ ]'} {tx('Slika vozila', 'Vehicle photo')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Slika v PDF in pri uvozu.', 'Photo in PDF and import.')}</p>
          </button>
          <button onClick={() => setIncludeReceiptImages(!includeReceiptImages)}
            className={`rounded-xl border p-4 text-left ${includeReceiptImages ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeReceiptImages ? '[x]' : '[ ]'} {tx('Slike racunov', 'Receipt photos')}</p>
            <p className="text-[#5a5a80] text-xs mt-1">{tx('Prenese slike racunov pri servisih, gorivu in stroskih.', 'Transfers receipt photos from services, fuel and expenses.')}</p>
          </button>
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">{tx('Zasebnost podatkov v PDF', 'Data privacy in PDF')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'showPlate', label: tx('Prikazi tablico', 'Show license plate') },
            { key: 'maskPlate', label: tx('Delno zakrij tablico', 'Partly hide license plate') },
            { key: 'showVin', label: tx('Prikazi VIN', 'Show VIN') },
            { key: 'maskVin', label: tx('Delno zakrij VIN', 'Partly hide VIN') },
            { key: 'showKm', label: tx('Prikazi kilometre', 'Show mileage') },
            { key: 'showFuel', label: tx('Prikazi gorivo', 'Show fuel') },
            { key: 'showYear', label: tx('Prikazi letnik', 'Show year') },
            { key: 'showOwnerCity', label: tx('Prikazi mesto lastnika', 'Show owner city') },
            { key: 'showOwnerAge', label: tx('Prikazi starost lastnika', 'Show owner age') },
          ].map((item) => {
            const active = privacy[item.key as keyof typeof privacy]
            return (
              <button key={item.key} onClick={() => setPrivacy(prev => ({ ...prev, [item.key]: !active }))}
                className={`rounded-xl border px-3 py-3 text-left text-xs font-bold ${active ? 'border-[#6c63ff66] bg-[#6c63ff22] text-[#a09aff]' : 'border-[#1e1e32] bg-[#13131f] text-[#5a5a80]'}`}>
                {active ? '[x]' : '[ ]'} {item.label}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-[#5a5a80]">
          {tx('Za potencialnega kupca lahko pokazes samo osnovo, za bodocega lastnika pa vkljucis vec podatkov in QR uvoz.', 'For a potential buyer you can show only the basics; for the next owner you can include more data and QR import.')}
        </p>
      </div>

      {ready && (
        <PDFDownloadLink
          document={<ReportPDF avto={avto} servisi={servisiForReport} gorivo={gorivoForReport} expenses={expensesForReport} verifyQr={verifyQr} importQr={importQr} includeVehicleImage={includeVehicleImage} language={language} privacy={privacy} />}
          fileName={`GarageBase_${avto?.znamka}_${avto?.model}_${new Date().toISOString().split('T')[0]}.pdf`}>
          {({ loading: pdfLoading }) => (
            <button onClick={() => trackEvent('report_pdf_download', { carId: avto?.id, includeVerifyQr, includeImportQr, includeVehicleImage, includeReceiptImages, includeServices, includeFuel, includeExpenses, expenseCategories: selectedExpenseCategories, privacy })} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg">
              {pdfLoading ? tx('Generiranje...', 'Generating...') : tx('Prenesi PDF Report', 'Download PDF Report')}
            </button>
          )}
        </PDFDownloadLink>
      )}

      <div className="mt-4 bg-[#f59e0b11] border border-[#f59e0b33] rounded-xl p-4">
        <p className="text-[#f59e0b] text-xs">
          {tx('PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroske - idealno za prodajo vozila.', 'The PDF report contains the full service history, fuel log and expenses - ideal when selling a vehicle.')}
        </p>
      </div>

      <HomeButton />
    </div>
  )
}
