'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { createTransferToken, scanUrl } from '@/lib/transfer'
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
  sRacun: { width: '15%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  sDateH: { width: '13%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sKmH: { width: '13%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sOpisH: { width: '44%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  sCenaH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  sRacunH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
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
  gRacun: { width: '14%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  gDateH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gKmH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gCenaH: { width: '17%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  gRacunH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
  // Expenses stolpci
  eDate: { width: '15%', fontSize: 8, color: '#333333' },
  eKat: { width: '18%', fontSize: 8, color: '#333333' },
  eOpis: { width: '37%', fontSize: 8, color: '#333333' },
  eCena: { width: '16%', fontSize: 8, color: '#333333', textAlign: 'right' },
  eRacun: { width: '14%', fontSize: 8, color: '#6c63ff', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  eDateH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eKatH: { width: '18%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eOpisH: { width: '37%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eCenaH: { width: '16%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  eRacunH: { width: '14%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
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
    qrRead: 'QR BRANJE: skeniraj za digitalni report iz GarageBase baze. Podatke primerjaj s PDF dokumentom.',
    qrImport: 'QR UVOZ ZGODOVINE: skeniraj za uvoz vozila in zgodovine v novo GarageBase garazo. Pred uvozom se prikaze potrditev.',
    serviceBook: 'Servisna knjiga',
    date: 'Datum',
    km: 'Km',
    work: 'Opis dela',
    price: 'Cena',
    receipt: 'Racun',
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
    qrRead: 'QR READ: scan for the digital report from the GarageBase database. Compare the data with the PDF document.',
    qrImport: 'QR HISTORY IMPORT: scan to import the vehicle and history into a new GarageBase garage. Confirmation is shown before import.',
    serviceBook: 'Service book',
    date: 'Date',
    km: 'Km',
    work: 'Work performed',
    price: 'Price',
    receipt: 'Receipt',
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

const ReportPDF = ({ avto, servisi, gorivo, expenses, verifyQr, importQr, includeVehicleImage, language = 'sl' }: any) => {
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
            {avto.letnik && <Text style={styles.carInfo}>{copy.year}: {avto.letnik}</Text>}
            {avto.tablica && <Text style={styles.carInfo}>{copy.plate}: {avto.tablica.toUpperCase()}</Text>}
            {avto.vin && <Text style={styles.carInfo}>VIN: {maskVin(avto.vin)}</Text>}
            {avto.gorivo && <Text style={styles.carInfo}>{copy.fuel}: {avto.gorivo}</Text>}
            {avto.km_trenutni && <Text style={styles.carInfo}>{copy.currentKm}: {avto.km_trenutni.toLocaleString()} km</Text>}
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
              <Text style={styles.statValue}>{avto.km_trenutni?.toLocaleString() || '-'}</Text>
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
              <Text style={styles.statValue}>{avto.lastnik_mesto || '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.ownerAge}</Text>
              <Text style={styles.statValue}>{avto.lastnik_starost || '-'}</Text>
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
            </View>
            {servisi.map((s: any, i: number) => (
              <View key={s.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.sDate}>{new Date(s.datum).toLocaleDateString(locale)}</Text>
                <Text style={styles.sKm}>{s.km?.toLocaleString()}</Text>
                <Text style={styles.sOpis}>{s.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 55)}{s.servis ? ` (${s.servis})` : ''}</Text>
                <Text style={styles.sCena}>{s.cena ? `${s.cena.toFixed(2)} EUR` : '-'}</Text>
                <Text style={styles.sRacun}>{s.foto_url ? `[ ${copy.yes} ]` : '-'}</Text>
              </View>
            ))}
            {imaPrivonke && (
              <Text style={styles.opomba}>
                {copy.receiptsNote}
              </Text>
            )}
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
              </View>
            ))}
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
            </View>
            {expenses.map((e: any, i: number) => (
              <View key={e.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.eDate}>{new Date(e.datum).toLocaleDateString(locale)}</Text>
                <Text style={styles.eKat}>{e.kategorija}</Text>
                <Text style={styles.eOpis}>{String(e.opis || '-').replace('[Prejsnji lastnik]', '[PREJSNJI]')}</Text>
                <Text style={styles.eCena}>{e.znesek?.toFixed(2)} EUR</Text>
                <Text style={styles.eRacun}>{e.receipt_url ? `[ ${copy.yes} ]` : '-'}</Text>
              </View>
            ))}
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
  const [language, setLanguage] = useState<Language>('sl')


  const pripraviQrKode = async (carId: string, userId: string, avtoData: any, servisData: any[], gorivoData: any[], filteredExpenses: any[], reportLanguage: Language) => {
    const carSummary = {
      znamka: avtoData?.znamka,
      model: avtoData?.model,
      letnik: avtoData?.letnik,
      gorivo: avtoData?.gorivo,
      vin_masked: maskVin(avtoData?.vin),
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
      tablica: avtoData?.tablica,
      vin: avtoData?.vin,
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
    const makePayload = (mode: 'verify' | 'import') => ({
      type: 'garagebase-transfer-v1',
      mode,
      language: reportLanguage,
      exportedAt: new Date().toISOString(),
      consent: true,
      car: carSummary,
      car_full: carFull,
      include_vehicle_image: includeVehicleImage,
      include_receipt_images: includeReceiptImages,
      service_logs: servisForTransfer,
      fuel_logs: gorivoForTransfer,
      expenses: expensesForTransfer,
    })

    setVerifyQr('')
    setImportQr('')
    if (includeVerifyQr) {
      const token = createTransferToken()
      await supabase.from('vehicle_transfers').insert({ token, car_id: carId, created_by: userId, mode: 'verify', consent: true, payload: makePayload('verify') })
      setVerifyQr(await QRCode.toDataURL(scanUrl(token), { width: 180, margin: 1 }))
    }
    if (includeImportQr) {
      const token = createTransferToken()
      await supabase.from('vehicle_transfers').insert({ token, car_id: carId, created_by: userId, mode: 'import', consent: true, payload: makePayload('import') })
      setImportQr(await QRCode.toDataURL(scanUrl(token), { width: 180, margin: 1 }))
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

      try {
        await pripraviQrKode(carId, user.id, avtoData, servisData || [], gorivoData || [], filteredExpenses, currentLanguage)
      } catch {
        setVerifyQr('')
        setImportQr('')
      }

      setLoading(false)
      setTimeout(() => setReady(true), 500)
    }
    init()
  }, [includeVerifyQr, includeImportQr, includeVehicleImage, includeReceiptImages])

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">Nalaganje podatkov...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">

      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">📄 PDF Report</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model}</p>}
        </div>
      </div>

      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">Vsebina reporta</p>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">🔧 Servisov</span>
            <span className="text-[#6c63ff] font-bold">{servisi.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">⛽ Tankanij</span>
            <span className="text-[#6c63ff] font-bold">{gorivo.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">💰 Dodatnih stroškov</span>
            <span className="text-[#6c63ff] font-bold">{expenses.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white text-sm">📎 Prilog računov</span>
            <span className="text-[#6c63ff] font-bold">
              {servisi.filter(s => s.foto_url).length + gorivo.filter(g => g.receipt_url).length + expenses.filter(e => e.receipt_url).length}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-[#1e1e32] pt-2 mt-1">
            <span className="text-white text-sm font-semibold">Skupaj stroški</span>
            <span className="text-[#3ecfcf] font-bold text-lg">
              {(servisi.reduce((s, v) => s + (v.cena || 0), 0) +
                gorivo.reduce((s, v) => s + (v.cena_skupaj || 0), 0) +
                expenses.reduce((s, v) => s + (v.znesek || 0), 0)).toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      {(servisi.some(s => s.foto_url) || gorivo.some(g => g.receipt_url) || expenses.some(e => e.receipt_url)) && (
        <div className="bg-[#6c63ff11] border border-[#6c63ff33] rounded-xl p-4 mb-4">
          <p className="text-[#a09aff] text-xs">
            To vozilo ima priložene slike računov. V PDF reportu so označene z [ DA ] — za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com
          </p>
        </div>
      )}


      <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4">
        <p className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3">QR kode v PDF</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setIncludeVerifyQr(!includeVerifyQr)}
            className={`rounded-xl border p-4 text-left ${includeVerifyQr ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeVerifyQr ? '[x]' : '[ ]'} Samo za branje</p>
            <p className="text-[#5a5a80] text-xs mt-1">QR za digitalni report.</p>
          </button>
          <button onClick={() => setIncludeImportQr(!includeImportQr)}
            className={`rounded-xl border p-4 text-left ${includeImportQr ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeImportQr ? '[x]' : '[ ]'} Izvoz zgodovine</p>
            <p className="text-[#5a5a80] text-xs mt-1">QR za uvoz vozila.</p>
          </button>
          <button onClick={() => setIncludeVehicleImage(!includeVehicleImage)}
            className={`rounded-xl border p-4 text-left ${includeVehicleImage ? 'bg-[#6c63ff22] border-[#6c63ff66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeVehicleImage ? '[x]' : '[ ]'} Slika vozila</p>
            <p className="text-[#5a5a80] text-xs mt-1">Slika v PDF in pri uvozu.</p>
          </button>
          <button onClick={() => setIncludeReceiptImages(!includeReceiptImages)}
            className={`rounded-xl border p-4 text-left ${includeReceiptImages ? 'bg-[#3ecfcf22] border-[#3ecfcf66]' : 'bg-[#13131f] border-[#1e1e32]'}`}>
            <p className="text-white text-sm font-semibold">{includeReceiptImages ? '[x]' : '[ ]'} Slike racunov</p>
            <p className="text-[#5a5a80] text-xs mt-1">Prenese slike racunov pri servisih, gorivu in stroskih.</p>
          </button>
        </div>
      </div>

      {ready && (
        <PDFDownloadLink
          document={<ReportPDF avto={avto} servisi={servisi} gorivo={gorivo} expenses={expenses} verifyQr={verifyQr} importQr={importQr} includeVehicleImage={includeVehicleImage} language={language} />}
          fileName={`GarageBase_${avto?.znamka}_${avto?.model}_${new Date().toISOString().split('T')[0]}.pdf`}>
          {({ loading: pdfLoading }) => (
            <button onClick={() => trackEvent('report_pdf_download', { carId: avto?.id, includeVerifyQr, includeImportQr, includeVehicleImage, includeReceiptImages })} className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg">
              {pdfLoading ? 'Generiranje...' : 'Prenesi PDF Report'}
            </button>
          )}
        </PDFDownloadLink>
      )}

      <div className="mt-4 bg-[#f59e0b11] border border-[#f59e0b33] rounded-xl p-4">
        <p className="text-[#f59e0b] text-xs">
          PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroške — idealno za prodajo vozila.
        </p>
      </div>

      <HomeButton />
    </div>
  )
}
