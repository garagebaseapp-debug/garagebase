'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton, HomeButton } from '@/lib/nav'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

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
  gDate: { width: '15%', fontSize: 8, color: '#333333' },
  gKm: { width: '15%', fontSize: 8, color: '#333333' },
  gOpis: { width: '40%', fontSize: 8, color: '#333333' },
gTip95: { width: '10%', fontSize: 8, color: '#16a34a', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTip100: { width: '10%', fontSize: 8, color: '#2563eb', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTipD: { width: '10%', fontSize: 8, color: '#888888', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
gTipH: { width: '10%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'center' },
gOpisH: { width: '40%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gCena: { width: '20%', fontSize: 8, color: '#333333', textAlign: 'right' },
  gDateH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gKmH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  gCenaH: { width: '20%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  // Expenses stolpci
  eDate: { width: '15%', fontSize: 8, color: '#333333' },
  eKat: { width: '20%', fontSize: 8, color: '#333333' },
  eOpis: { width: '45%', fontSize: 8, color: '#333333' },
  eCena: { width: '20%', fontSize: 8, color: '#333333', textAlign: 'right' },
  eDateH: { width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eKatH: { width: '20%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eOpisH: { width: '45%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  eCenaH: { width: '20%', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  opomba: { fontSize: 8, color: '#5555cc', marginTop: 8, padding: 8, backgroundColor: '#f0f0ff', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#6c63ff' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 8 },
  footerText: { fontSize: 8, color: '#aaaaaa' },
})

const ReportPDF = ({ avto, servisi, gorivo, expenses }: any) => {
  const skupajGorivo = gorivo.reduce((s: number, v: any) => s + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((s: number, v: any) => s + (v.cena || 0), 0)
  const skupajExpenses = expenses.reduce((s: number, v: any) => s + (v.znesek || 0), 0)
  const skupajVse = skupajGorivo + skupajServis + skupajExpenses
  const skupajLitrov = gorivo.reduce((s: number, v: any) => s + (v.litri || 0), 0)
  const danes = new Date().toLocaleDateString('sl-SI')
  const imaPrivonke = servisi.some((s: any) => s.foto_url)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>GarageBase</Text>
            <Text style={styles.appSubtitle}>Servisna knjiga in evidenca vozila</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>VERIFICIRAN REPORT</Text>
            </View>
          </View>
          <View>
            <Text style={styles.carTitle}>
              {avto.znamka?.charAt(0).toUpperCase() + avto.znamka?.slice(1)} {avto.model?.toUpperCase()}
            </Text>
            {avto.letnik && <Text style={styles.carInfo}>Letnik: {avto.letnik}</Text>}
            {avto.tablica && <Text style={styles.carInfo}>Tablica: {avto.tablica.toUpperCase()}</Text>}
            {avto.vin && <Text style={styles.carInfo}>VIN: {avto.vin.substring(0, 9)}{'*'.repeat(avto.vin.length - 9)}</Text>}
            {avto.gorivo && <Text style={styles.carInfo}>Gorivo: {avto.gorivo}</Text>}
            {avto.km_trenutni && <Text style={styles.carInfo}>Trenutni km: {avto.km_trenutni.toLocaleString()} km</Text>}
            <Text style={styles.reportDate}>Generirano: {danes}</Text>
          </View>
        </View>

        {/* Statistike */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pregled stroskov</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SKUPAJ STROSKI</Text>
              <Text style={styles.statValue}>{skupajVse.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>GORIVO</Text>
              <Text style={styles.statValue}>{skupajGorivo.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SERVISI</Text>
              <Text style={styles.statValue}>{skupajServis.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>OSTALO</Text>
              <Text style={styles.statValue}>{skupajExpenses.toFixed(2)} EUR</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SKUPAJ LITROV</Text>
              <Text style={styles.statValue}>{skupajLitrov.toFixed(0)} L</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ST. SERVISOV</Text>
              <Text style={styles.statValue}>{servisi.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ST. TANKANIJ</Text>
              <Text style={styles.statValue}>{gorivo.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TRENUTNI KM</Text>
              <Text style={styles.statValue}>{avto.km_trenutni?.toLocaleString() || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Servisna knjiga */}
        {servisi.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Servisna knjiga</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.sDateH}>Datum</Text>
              <Text style={styles.sKmH}>Km</Text>
              <Text style={styles.sOpisH}>Opis dela</Text>
              <Text style={styles.sCenaH}>Cena</Text>
              <Text style={styles.sRacunH}>Racun</Text>
            </View>
            {servisi.map((s: any, i: number) => (
              <View key={s.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.sDate}>{new Date(s.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.sKm}>{s.km?.toLocaleString()}</Text>
                <Text style={styles.sOpis}>{s.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 55)}{s.servis ? ` (${s.servis})` : ''}</Text>
                <Text style={styles.sCena}>{s.cena ? `${s.cena.toFixed(2)} EUR` : '-'}</Text>
                <Text style={styles.sRacun}>{s.foto_url ? '[ DA ]' : '-'}</Text>
              </View>
            ))}
            {imaPrivonke && (
              <Text style={styles.opomba}>
                [ DA ] = Slike racunov so pritozene v GarageBase aplikaciji. Za ogled originalnih racunov zahtevajte dostop pri prodajalcu vozila ali obisite getgaragebase.com
              </Text>
            )}
          </View>
        )}

        {/* Gorivo */}
        {gorivo.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evidenca goriva</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.gDateH}>Datum</Text>
              <Text style={styles.gKmH}>Km</Text>
              <Text style={styles.gTipH}>Tip</Text>
<Text style={styles.gOpisH}>Litri - Postaja</Text>
              <Text style={styles.gCenaH}>Cena</Text>
            </View>
            {gorivo.map((g: any, i: number) => (
              <View key={g.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.gDate}>{new Date(g.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.gKm}>{g.km?.toLocaleString()}</Text>
                <Text style={g.tip_goriva === '95' ? styles.gTip95 : g.tip_goriva === '100' ? styles.gTip100 : styles.gTipD}>
  {g.tip_goriva === '95' ? '95' : g.tip_goriva === '100' ? '100' : g.tip_goriva === 'diesel' ? 'D' : '-'}
</Text>
<Text style={styles.gOpis}>{g.litri} L{g.postaja ? ` - ${g.postaja}` : ''}</Text>
                <Text style={styles.gCena}>{g.cena_skupaj ? `${g.cena_skupaj.toFixed(2)} EUR` : '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dodatni stroski */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dodatni stroski</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.eDateH}>Datum</Text>
              <Text style={styles.eKatH}>Kategorija</Text>
              <Text style={styles.eOpisH}>Opis</Text>
              <Text style={styles.eCenaH}>Znesek</Text>
            </View>
            {expenses.map((e: any, i: number) => (
              <View key={e.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.eDate}>{new Date(e.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.eKat}>{e.kategorija}</Text>
                <Text style={styles.eOpis}>{e.opis || '-'}</Text>
                <Text style={styles.eCena}>{e.znesek?.toFixed(2)} EUR</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GarageBase - getgaragebase.com</Text>
          <Text style={styles.footerText}>Generirano: {danes}</Text>
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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      const carId = params.get('car')
      if (!carId) { window.location.href = '/garaza'; return }

      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).single()
      setAvto(avtoData)
      const { data: servisData } = await supabase.from('service_logs').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setServisi(servisData || [])
      const { data: gorivoData } = await supabase.from('fuel_logs').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setGorivo(gorivoData || [])
      const { data: expensesData } = await supabase.from('expenses').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setExpenses((expensesData || []).filter((e: any) => e.kategorija !== 'km_sprememba'))

      setLoading(false)
      setTimeout(() => setReady(true), 500)
    }
    init()
  }, [])

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
            <span className="text-[#6c63ff] font-bold">{servisi.filter(s => s.foto_url).length}</span>
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

      {servisi.some(s => s.foto_url) && (
        <div className="bg-[#6c63ff11] border border-[#6c63ff33] rounded-xl p-4 mb-4">
          <p className="text-[#a09aff] text-xs">
            To vozilo ima priložene slike računov. V PDF reportu so označene z [ DA ] — za ogled originalnih slik zahtevaj dostop v GarageBase aplikaciji na getgaragebase.com
          </p>
        </div>
      )}

      {ready && (
        <PDFDownloadLink
          document={<ReportPDF avto={avto} servisi={servisi} gorivo={gorivo} expenses={expenses} />}
          fileName={`GarageBase_${avto?.znamka}_${avto?.model}_${new Date().toISOString().split('T')[0]}.pdf`}>
          {({ loading: pdfLoading }) => (
            <button className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg">
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