'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BackButton } from '@/lib/nav'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// PDF Styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#6c63ff',
  },
  headerLeft: { flex: 1 },
  appName: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  appSubtitle: { fontSize: 10, color: '#888888', marginTop: 4 },
  reportDate: { fontSize: 9, color: '#888888', textAlign: 'right', marginTop: 4 },
  carTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111111', marginBottom: 4 },
  carInfo: { fontSize: 10, color: '#555555', marginBottom: 2 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#6c63ff',
    marginBottom: 8, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBox: {
    flex: 1, backgroundColor: '#f8f8ff', borderRadius: 6,
    padding: 10, borderWidth: 1, borderColor: '#e0e0e0',
  },
  statLabel: { fontSize: 8, color: '#888888', marginBottom: 2 },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111111' },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#f0f0ff',
    padding: 6, borderRadius: 4, marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', padding: 6,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tableRowAlt: {
    flexDirection: 'row', padding: 6,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  colDate: { width: '18%', fontSize: 9, color: '#333333' },
  colKm: { width: '18%', fontSize: 9, color: '#333333' },
  colOpis: { width: '44%', fontSize: 9, color: '#333333' },
  colCena: { width: '20%', fontSize: 9, color: '#333333', textAlign: 'right' },
  colDateH: { width: '18%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  colKmH: { width: '18%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  colOpisH: { width: '44%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6c63ff' },
  colCenaH: { width: '20%', fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6c63ff', textAlign: 'right' },
  footer: {
    position: 'absolute', bottom: 30, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 10,
  },
  footerText: { fontSize: 8, color: '#aaaaaa' },
  badge: {
    backgroundColor: '#6c63ff', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
})

// PDF Document komponenta
const ReportPDF = ({ avto, servisi, gorivo, expenses, opomniki }: any) => {
  const skupajGorivo = gorivo.reduce((s: number, v: any) => s + (v.cena_skupaj || 0), 0)
  const skupajServis = servisi.reduce((s: number, v: any) => s + (v.cena || 0), 0)
  const skupajExpenses = expenses.reduce((s: number, v: any) => s + (v.znesek || 0), 0)
  const skupajVse = skupajGorivo + skupajServis + skupajExpenses
  const skupajLitrov = gorivo.reduce((s: number, v: any) => s + (v.litri || 0), 0)
  const danes = new Date().toLocaleDateString('sl-SI')

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>GarageBase</Text>
            <Text style={styles.appSubtitle}>Servisna knjiga in evidenca vozila</Text>
            <View style={{ marginTop: 8 }}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>VERIFICIRAN REPORT</Text>
              </View>
            </View>
          </View>
          <View>
            <Text style={styles.carTitle}>
              {avto.znamka?.charAt(0).toUpperCase() + avto.znamka?.slice(1)} {avto.model?.toUpperCase()}
            </Text>
            {avto.letnik && <Text style={styles.carInfo}>Letnik: {avto.letnik}</Text>}
            {avto.tablica && <Text style={styles.carInfo}>Tablica: {avto.tablica.toUpperCase()}</Text>}
            {avto.vin && <Text style={styles.carInfo}>VIN: {avto.vin}</Text>}
            {avto.gorivo && <Text style={styles.carInfo}>Gorivo: {avto.gorivo}</Text>}
            {avto.km_trenutni && <Text style={styles.carInfo}>Trenutni km: {avto.km_trenutni.toLocaleString()} km</Text>}
            <Text style={styles.reportDate}>Generirano: {danes}</Text>
          </View>
        </View>

        {/* Statistike */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Pregled stroškov</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SKUPAJ STROŠKI</Text>
              <Text style={styles.statValue}>{skupajVse.toFixed(2)} €</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>GORIVO</Text>
              <Text style={styles.statValue}>{skupajGorivo.toFixed(2)} €</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SERVISI</Text>
              <Text style={styles.statValue}>{skupajServis.toFixed(2)} €</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>OSTALO</Text>
              <Text style={styles.statValue}>{skupajExpenses.toFixed(2)} €</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SKUPAJ LITROV</Text>
              <Text style={styles.statValue}>{skupajLitrov.toFixed(0)} L</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>SERVISOV</Text>
              <Text style={styles.statValue}>{servisi.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TANKANIJ</Text>
              <Text style={styles.statValue}>{gorivo.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>KM</Text>
              <Text style={styles.statValue}>{avto.km_trenutni?.toLocaleString() || '—'}</Text>
            </View>
          </View>
        </View>

        {/* Servisna knjiga */}
        {servisi.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Servisna knjiga</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colDateH}>Datum</Text>
              <Text style={styles.colKmH}>Km</Text>
              <Text style={styles.colOpisH}>Opis</Text>
              <Text style={styles.colCenaH}>Cena</Text>
            </View>
            {servisi.map((s: any, i: number) => (
              <View key={s.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.colDate}>{new Date(s.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.colKm}>{s.km?.toLocaleString()}</Text>
                <Text style={styles.colOpis}>{s.opis?.replace(/\s*\[Naknadno.*?\]/, '').substring(0, 60)}{s.servis ? ` (${s.servis})` : ''}</Text>
                <Text style={styles.colCena}>{s.cena ? `${s.cena.toFixed(2)} €` : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Gorivo */}
        {gorivo.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⛽ Evidenca goriva</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colDateH}>Datum</Text>
              <Text style={styles.colKmH}>Km</Text>
              <Text style={styles.colOpisH}>Litri · Postaja</Text>
              <Text style={styles.colCenaH}>Cena</Text>
            </View>
            {gorivo.map((g: any, i: number) => (
              <View key={g.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.colDate}>{new Date(g.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.colKm}>{g.km?.toLocaleString()}</Text>
                <Text style={styles.colOpis}>{g.litri} L{g.postaja ? ` · ${g.postaja}` : ''}</Text>
                <Text style={styles.colCena}>{g.cena_skupaj ? `${g.cena_skupaj.toFixed(2)} €` : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dodatni stroški */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Dodatni stroški</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colDateH}>Datum</Text>
              <Text style={styles.colKmH}>Kategorija</Text>
              <Text style={styles.colOpisH}>Opis</Text>
              <Text style={styles.colCenaH}>Znesek</Text>
            </View>
            {expenses.map((e: any, i: number) => (
              <View key={e.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.colDate}>{new Date(e.datum).toLocaleDateString('sl-SI')}</Text>
                <Text style={styles.colKm}>{e.kategorija}</Text>
                <Text style={styles.colOpis}>{e.opis || '—'}</Text>
                <Text style={styles.colCena}>{e.znesek?.toFixed(2)} €</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GarageBase — getgaragebase.com</Text>
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
  const [opomniki, setOpomniki] = useState<any[]>([])
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

      const { data: opomData } = await supabase.from('reminders').select('*').eq('car_id', carId)
      setOpomniki(opomData || [])

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

      {/* Pregled */}
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

      {/* Download gumb */}
      {ready && (
        <PDFDownloadLink
          document={<ReportPDF avto={avto} servisi={servisi} gorivo={gorivo} expenses={expenses} opomniki={opomniki} />}
          fileName={`GarageBase_${avto?.znamka}_${avto?.model}_${new Date().toISOString().split('T')[0]}.pdf`}>
          {({ loading: pdfLoading }) => (
            <button className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg">
              {pdfLoading ? '⏳ Generiranje...' : '📥 Prenesi PDF Report'}
            </button>
          )}
        </PDFDownloadLink>
      )}

      <div className="mt-4 bg-[#f59e0b11] border border-[#f59e0b33] rounded-xl p-4">
        <p className="text-[#f59e0b] text-xs">
          💡 PDF report vsebuje celotno servisno zgodovino, evidenco goriva in stroške — idealno za prodajo vozila.
        </p>
      </div>

    </div>
  )
}