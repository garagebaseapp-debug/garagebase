'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeButton, BackButton } from '@/lib/nav'
import { useLanguage } from '@/lib/i18n'

export default function Opomniki() {
  const { language } = useLanguage()
  const [avto, setAvto] = useState<any>(null)
  const [opomniki, setOpomniki] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tip, setTip] = useState('registracija')
  const [tipCustom, setTipCustom] = useState('')
  const [datum, setDatum] = useState('')
  const [kmOpomnik, setKmOpomnik] = useState('')
  const [opozoriloDni, setOpozoriloDni] = useState('30')
  const [opozoriloDniCustom, setOpozoriloDniCustom] = useState('')
  const [paketLetniDokumenti, setPaketLetniDokumenti] = useState(false)
  const [izbraniDokumenti, setIzbraniDokumenti] = useState<string[]>(['registracija', 'tehnicni', 'zavarovanje'])
  const [pogled, setPogled] = useState<'active' | 'completed'>('active')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [koledarPrioritete, setKoledarPrioritete] = useState<{ [key: string]: string }>({})
  const tx = (sl: string, en: string) => language === 'en' ? en : sl
  const locale = language === 'en' ? 'en-US' : 'sl-SI'

  const tipi = [
    { vrednost: 'dokumenti', ikona: 'DOC', naziv: 'Dokumenti vozila' },
    { vrednost: 'registracija', ikona: '📋', naziv: 'Registracija' },
    { vrednost: 'vinjeta', ikona: '🛣️', naziv: 'Vinjeta' },
    { vrednost: 'tehnicni', ikona: '🔍', naziv: 'Tehnični pregled' },
    { vrednost: 'servis', ikona: '🔧', naziv: 'Servis' },
    { vrednost: 'zavarovanje', ikona: '🛡️', naziv: 'Zavarovanje' },
    { vrednost: 'gume', ikona: '⚫', naziv: 'Gume' },
    { vrednost: 'custom', ikona: '✏️', naziv: 'Drugo...' },
  ]

  const dokumentTipi = ['registracija', 'tehnicni', 'zavarovanje', 'vinjeta']

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const params = new URLSearchParams(window.location.search)
      let carId = params.get('car')
      if (params.get('add') === '1') setShowForm(true)
      if (!carId) {
        const { data: prviAvto } = await supabase
          .from('cars')
          .select('*')
          .eq('user_id', user.id)
          .or('arhivirano.is.null,arhivirano.eq.false')
          .order('vrstni_red', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (!prviAvto) { window.location.href = '/garaza'; return }
        carId = prviAvto.id
      }
      const { data: avtoData } = await supabase.from('cars').select('*').eq('id', carId).eq('user_id', user.id).maybeSingle()
      if (!avtoData) { window.location.href = '/garaza'; return }
      setAvto(avtoData)
      const { data: opData } = await supabase.from('reminders').select('*').eq('car_id', carId).order('datum', { ascending: true })
      setOpomniki(opData || [])
      setLoading(false)
    }
    init()
  }, [])

  const dniDo = (datum: string) => {
    if (!datum) return null
    return Math.ceil((new Date(datum).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  // Izračun preostalih km do opomnika
  const kmDo = (kmOpomnik: number) => {
    if (!avto?.km_trenutni) return null
    return kmOpomnik - avto.km_trenutni
  }

  // Barva glede na dni
  const barvaZaDni = (dni: number | null) => {
    if (dni === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (dni <= 7) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (dni <= 30) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Barva glede na km
  const barvaZaKm = (preostaloKm: number | null) => {
    if (preostaloKm === null) return { text: 'text-[#5a5a80]', bg: 'bg-[#13131f]', border: 'border-[#1e1e32]' }
    if (preostaloKm <= 0) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 500) return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    if (preostaloKm <= 1500) return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  // Skupna barva — vzame slabšo od datuma ali km
  const skupnaBarva = (dni: number | null, preostaloKm: number | null) => {
    const bdni = barvaZaDni(dni)
    const bkm = barvaZaKm(preostaloKm)
    // Rdeča ima prioriteto
    if (bdni.text === 'text-[#ef4444]' || bkm.text === 'text-[#ef4444]') {
      return { text: 'text-[#ef4444]', bg: 'bg-[#ef444411]', border: 'border-[#ef444433]' }
    }
    if (bdni.text === 'text-[#f59e0b]' || bkm.text === 'text-[#f59e0b]') {
      return { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b11]', border: 'border-[#f59e0b33]' }
    }
    return { text: 'text-[#3ecfcf]', bg: 'bg-[#3ecfcf11]', border: 'border-[#3ecfcf33]' }
  }

  const tipIkona: any = { registracija: '📋', vinjeta: '🛣️', tehnicni: '🔍', servis: '🔧', zavarovanje: '🛡️', gume: '⚫' }
  const tipNaziv: any = {
    dokumenti: tx('Dokumenti vozila', 'Vehicle documents'),
    registracija: tx('Registracija', 'Registration'),
    vinjeta: tx('Vinjeta', 'Vignette'),
    tehnicni: tx('Tehnični pregled', 'Technical inspection'),
    servis: tx('Servis', 'Service'),
    zavarovanje: tx('Zavarovanje', 'Insurance'),
    gume: tx('Gume', 'Tires'),
    custom: tx('Drugo...', 'Other...'),
  }
  tipIkona.dokumenti = 'DOC'

  const preklopiDokument = (vrednost: string) => {
    setIzbraniDokumenti((prev) => (
      prev.includes(vrednost)
        ? prev.filter((item) => item !== vrednost)
        : [...prev, vrednost]
    ))
  }

  const shrani = async () => {
    if (!datum && !kmOpomnik) { setMessage(tx('Vnesi datum ali km!', 'Enter a date or mileage!')); return }
    if (tip === 'custom' && !tipCustom) { setMessage(tx('Vnesi naziv opomnika!', 'Enter reminder name!')); return }
    if (tip === 'dokumenti' && !datum) { setMessage(tx('Za dokumente vozila vnesi datum.', 'Enter a date for vehicle documents.')); return }
    if (tip === 'dokumenti' && izbraniDokumenti.length === 0) { setMessage(tx('Izberi vsaj en dokument vozila.', 'Choose at least one vehicle document.')); return }
    if (opozoriloDni === 'custom' && !opozoriloDniCustom) { setMessage(tx('Vnesi število dni!', 'Enter number of days!')); return }
    const vneseniKmOpomnik = tip === 'dokumenti' ? null : (kmOpomnik ? parseInt(kmOpomnik) : null)
    if (vneseniKmOpomnik !== null && avto?.km_trenutni && vneseniKmOpomnik < avto.km_trenutni) {
      setMessage(`${tx('Km opomnik ne sme biti nižji od trenutnih', 'Mileage reminder cannot be lower than current')} ${avto.km_trenutni.toLocaleString(locale)} km.`)
      return
    }

    setSaving(true)
    const finalniTip = tip === 'custom' ? tipCustom : tip
    const finalniDni = opozoriloDni === 'custom' ? parseInt(opozoriloDniCustom) : parseInt(opozoriloDni)
    const letniDokumenti = ['registracija', 'tehnicni', 'zavarovanje']
    const tipiZaShranjevanje = tip === 'dokumenti'
      ? izbraniDokumenti
      : paketLetniDokumenti && datum && letniDokumenti.includes(tip)
        ? letniDokumenti
        : [finalniTip]

    const { error } = await supabase.from('reminders').insert(tipiZaShranjevanje.map((tipZaShranjevanje) => ({
      car_id: avto.id,
      tip: tipZaShranjevanje,
      datum: datum || null,
      km_opomnik: vneseniKmOpomnik,
      opozorilo_dni_prej: finalniDni,
    })))

    if (error) { setMessage(`${tx('Napaka:', 'Error:')} ${error.message}`) }
    else {
      const { data } = await supabase.from('reminders').select('*').eq('car_id', avto.id).order('datum', { ascending: true })
      setOpomniki(data || [])
      setShowForm(false)
      setDatum(''); setKmOpomnik(''); setTipCustom(''); setOpozoriloDniCustom(''); setPaketLetniDokumenti(false); setIzbraniDokumenti(['registracija', 'tehnicni', 'zavarovanje'])
      setTip('registracija'); setOpozoriloDni('30')
      setMessage('')
    }
    setSaving(false)
  }

  const izbrisiOpomnik = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id).eq('car_id', avto.id)
    setOpomniki(opomniki.filter(o => o.id !== id))
  }

  const izbrisiOpomnike = async (ids: string[]) => {
    if (ids.length === 1) {
      await izbrisiOpomnik(ids[0])
      return
    }
    await supabase.from('reminders').delete().in('id', ids).eq('car_id', avto.id)
    setOpomniki(opomniki.filter(o => !ids.includes(o.id)))
  }

  const oznaciOpomnikeOpravljeno = async (ids: string[]) => {
    if (!ids.length || !avto?.id) return
    const completedAt = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'completed', completed_at: completedAt })
      .in('id', ids)
      .eq('car_id', avto.id)

    if (error) {
      setMessage(`${tx('Napaka pri označevanju opomnika:', 'Error completing reminder:')} ${error.message}`)
      return
    }
    setOpomniki(opomniki.map((op) => ids.includes(op.id) ? { ...op, status: 'completed', completed_at: completedAt } : op))
  }

  const obnoviOpomnike = async (ids: string[]) => {
    if (!ids.length || !avto?.id) return
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'active', completed_at: null, completed_note: null })
      .in('id', ids)
      .eq('car_id', avto.id)

    if (error) {
      setMessage(`${tx('Napaka pri obnovi opomnika:', 'Error restoring reminder:')} ${error.message}`)
      return
    }
    setOpomniki(opomniki.map((op) => ids.includes(op.id) ? { ...op, status: 'active', completed_at: null, completed_note: null } : op))
  }

  const arhivirajOpomnike = async (ids: string[]) => {
    if (!ids.length || !avto?.id) return
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'archived' })
      .in('id', ids)
      .eq('car_id', avto.id)

    if (error) {
      setMessage(`${tx('Napaka pri arhiviranju opomnika:', 'Error archiving reminder:')} ${error.message}`)
      return
    }
    setOpomniki(opomniki.map((op) => ids.includes(op.id) ? { ...op, status: 'archived' } : op))
  }

  const escapeIcs = (value: string) => String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')

  const formatIcsDate = (value: string) => value.replace(/-/g, '')

  const prenesiKoledar = (op: any) => {
    if (!op.datum) {
      setMessage(tx('Za koledar mora imeti opomnik datum.', 'A reminder must have a date to export it to calendar.'))
      return
    }

    const opomnikiZaKoledar = Array.isArray(op.items) ? op.items : [op]
    const jePaket = opomnikiZaKoledar.length > 1
    const naziv = jePaket ? tipNaziv.dokumenti : (tipNaziv[op.tip] || op.tip)
    const dokumentiOpis = jePaket
      ? `${tx('Dokumenti', 'Documents')}: ${opomnikiZaKoledar.map((item: any) => tipNaziv[item.tip] || item.tip).join(', ')}`
      : ''
    const avtoNaziv = `${avto?.znamka || ''} ${avto?.model || ''}`.trim()
    const prioriteta = koledarPrioritete[op.id] || '5'
    const start = formatIcsDate(op.datum)
    const uid = `garagebase-${jePaket ? opomnikiZaKoledar.map((item: any) => item.id).join('-') : op.id}@getgaragebase.com`
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const opis = [
      `${tx('Vozilo', 'Vehicle')}: ${avtoNaziv}`,
      dokumentiOpis,
      !jePaket && op.km_opomnik ? `${tx('Km opomnik', 'Mileage reminder')}: ${op.km_opomnik.toLocaleString(locale)} km` : '',
      `${tx('Opozori', 'Alert')} ${op.opozorilo_dni_prej || 30} ${tx('dni prej', 'days before')}`,
      tx('Ustvarjeno v GarageBase', 'Created in GarageBase')
    ].filter(Boolean).join('\\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//GarageBase//${language === 'en' ? 'Reminders' : 'Opomniki'}//${language.toUpperCase()}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${start}`,
      `SUMMARY:${escapeIcs(`${naziv} - ${avtoNaziv}`)}`,
      `DESCRIPTION:${escapeIcs(opis)}`,
      `PRIORITY:${prioriteta}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `garagebase-${naziv}-${avtoNaziv}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <p className="text-[#5a5a80]">{tx('Nalaganje...', 'Loading...')}</p>
    </div>
  )

  const activeOpomniki = opomniki.filter((op) => (op.status || 'active') === 'active')
  const completedOpomniki = opomniki.filter((op) => op.status === 'completed')
  const rdeciOpomniki = activeOpomniki.filter((op) => {
    const dni = dniDo(op.datum)
    const preostaloKm = op.km_opomnik ? kmDo(op.km_opomnik) : null
    return (dni !== null && dni < 0) || (preostaloKm !== null && preostaloKm <= 0)
  })
  const kmOpomniki = activeOpomniki.filter((op) => op.km_opomnik)
  const datumskiOpomniki = activeOpomniki.filter((op) => op.datum)
  const uporabljeniOpomniki = new Set<string>()
  const prikazOpomnikov: any[] = []
  const prikazOpravljenihOpomnikov: any[] = []
  const dokumentKljuči = new Map<string, any[]>()
  const opravljeniDokumentKljuči = new Map<string, any[]>()

  activeOpomniki.forEach((op) => {
    if (op.datum && dokumentTipi.includes(op.tip) && !op.km_opomnik) {
      const kljuc = `${op.datum}|${op.opozorilo_dni_prej || 30}`
      dokumentKljuči.set(kljuc, [...(dokumentKljuči.get(kljuc) || []), op])
    }
  })

  dokumentKljuči.forEach((items) => {
    if (items.length < 2) return
    items.forEach((item) => uporabljeniOpomniki.add(item.id))
    prikazOpomnikov.push({
      ...items[0],
      id: `docs-${items.map((item) => item.id).join('-')}`,
      tip: 'dokumenti',
      items,
    })
  })

  activeOpomniki.forEach((op) => {
    if (!uporabljeniOpomniki.has(op.id)) prikazOpomnikov.push(op)
  })

  prikazOpomnikov.sort((a, b) => new Date(a.datum || '9999-12-31').getTime() - new Date(b.datum || '9999-12-31').getTime())

  completedOpomniki.forEach((op) => {
    if (op.datum && dokumentTipi.includes(op.tip) && !op.km_opomnik) {
      const kljuc = `${op.datum}|${op.opozorilo_dni_prej || 30}|${op.completed_at || ''}`
      opravljeniDokumentKljuči.set(kljuc, [...(opravljeniDokumentKljuči.get(kljuc) || []), op])
    }
  })

  const uporabljeniOpravljeniOpomniki = new Set<string>()
  opravljeniDokumentKljuči.forEach((items) => {
    if (items.length < 2) return
    items.forEach((item) => uporabljeniOpravljeniOpomniki.add(item.id))
    prikazOpravljenihOpomnikov.push({
      ...items[0],
      id: `done-docs-${items.map((item) => item.id).join('-')}`,
      tip: 'dokumenti',
      items,
    })
  })

  completedOpomniki.forEach((op) => {
    if (!uporabljeniOpravljeniOpomniki.has(op.id)) prikazOpravljenihOpomnikov.push(op)
  })
  prikazOpravljenihOpomnikov.sort((a, b) => new Date(b.completed_at || b.datum || '1900-01-01').getTime() - new Date(a.completed_at || a.datum || '1900-01-01').getTime())
  const seznamZaPrikaz = pogled === 'active' ? prikazOpomnikov : prikazOpravljenihOpomnikov

  return (
    <div className="min-h-screen bg-[#080810] px-4 py-6 pb-24">
      <div className="w-full xl:mx-auto xl:max-w-5xl">

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-white">🔔 {tx('Opomniki', 'Reminders')}</h1>
          {avto && <p className="text-[#5a5a80] text-xs">{avto.znamka} {avto.model} · {avto.km_trenutni?.toLocaleString(locale)} km</p>}
        </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="rounded-2xl bg-[#6c63ff] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#6c63ff33]">
            + {tx('Dodaj opomnik', 'Add reminder')}
          </button>
        )}
      </div>

      <div className="mb-6 hidden grid-cols-4 gap-4 xl:grid">
        {[
          { label: tx('Aktivni opomniki', 'Active reminders'), value: activeOpomniki.length, tone: 'text-[#a09aff]' },
          { label: tx('Nujni', 'Urgent'), value: rdeciOpomniki.length, tone: 'text-[#ef4444]' },
          { label: tx('Datumski opomniki', 'Date reminders'), value: datumskiOpomniki.length, tone: 'text-[#3ecfcf]' },
          { label: tx('KM opomniki', 'Mileage reminders'), value: kmOpomniki.length, tone: 'text-[#22c55e]' },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-[#1e1e32] bg-[#0f0f1a] p-5 text-center shadow-xl shadow-black/10">
            <p className={`text-3xl font-black ${item.tone}`}>{item.value}</p>
            <p className="mt-2 text-sm font-bold text-[#8a8aa8]">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Forma za nov opomnik je nad zgodovino, da uporabnik ne išče vnosa na dnu strani. */}
      {showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4 flex flex-col gap-4">
          <h2 className="text-white font-semibold">{tx('Dodaj opomnik', 'Add reminder')}</h2>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">{tx('Tip', 'Type')}</label>
            <div className="grid grid-cols-4 gap-2">
              {tipi.map((t) => (
                <button key={t.vrednost} type="button"
                  onClick={() => setTip(t.vrednost)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                    tip === t.vrednost
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  <span className="text-lg">{t.ikona}</span>
                  <span className="text-[8px] uppercase tracking-wider text-center leading-tight">{tipNaziv[t.vrednost] || t.naziv}</span>
                </button>
              ))}
            </div>
          </div>

          {tip === 'dokumenti' && (
            <div className="rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#3ecfcf]">{tx('Izberi dokumente', 'Choose documents')}</p>
              <div className="grid grid-cols-2 gap-2">
                {dokumentTipi.map((vrednost) => (
                  <label key={vrednost} className="flex items-center gap-2 rounded-xl border border-[#1e1e32] bg-[#13131f] px-3 py-2 text-sm font-black text-white">
                    <input type="checkbox" checked={izbraniDokumenti.includes(vrednost)} onChange={() => preklopiDokument(vrednost)} className="h-4 w-4 accent-[#6c63ff]" />
                    <span>{tipNaziv[vrednost]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#a8b0c0]">{tx('Izbrani dokumenti se prikažejo kot ena kartica, obvestilo pa ostane pregledno.', 'Selected documents are shown as one card and the notification stays clear.')}</p>
            </div>
          )}

          {tip === 'custom' && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Naziv opomnika', 'Reminder name')} *</label>
              <input type="text" value={tipCustom} onChange={e => setTipCustom(e.target.value)}
                placeholder={tx('npr. Menjava žarnic...', 'e.g. Bulb replacement...')}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum poteka', 'Due date')}</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>

            {tip !== 'dokumenti' && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
                {tx('Km opomnik', 'Mileage reminder')} <span className="text-[#3a3a5a] normal-case">({tx('trenutni', 'current')}: {avto?.km_trenutni?.toLocaleString(locale)} km)</span>
              </label>
              <input type="number" value={kmOpomnik} onChange={e => setKmOpomnik(e.target.value)}
                placeholder={`${tx('npr.', 'e.g.')} ${(avto?.km_trenutni || 0) + 15000}`}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
            )}
          </div>

          {['registracija', 'tehnicni', 'zavarovanje'].includes(tip) && datum && (
            <label className="flex items-start gap-3 rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-3 text-sm font-semibold text-[#d8ffff]">
              <input
                type="checkbox"
                checked={paketLetniDokumenti}
                onChange={(e) => setPaketLetniDokumenti(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#3ecfcf]"
              />
              <span>{tx('Dodaj skupaj registracijo, tehnični pregled in zavarovanje za isti datum.', 'Add registration, technical inspection and insurance together for the same date.')}</span>
            </label>
          )}

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Opozori X dni prej', 'Alert X days before')}</label>
            <div className="grid grid-cols-5 gap-2">
              {['7', '14', '30', '60', 'custom'].map((d) => (
                <button key={d} type="button"
                  onClick={() => setOpozoriloDni(d)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    opozoriloDni === d
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {d === 'custom' ? '✎' : d}
                </button>
              ))}
            </div>
            {opozoriloDni === 'custom' && (
              <input type="number" value={opozoriloDniCustom} onChange={e => setOpozoriloDniCustom(e.target.value)}
                placeholder={tx('npr. 45', 'e.g. 45')}
                className="w-full mt-2 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            )}
          </div>

          {message && <div className="p-3 rounded-xl text-sm border bg-[#ef444422] border-[#ef444444] text-[#fca5a5]">{message}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setShowForm(false); setMessage('') }}
              className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-3 rounded-xl text-sm">
              {tx('Prekliči', 'Cancel')}
            </button>
            <button onClick={shrani} disabled={saving}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm">
              {saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani', 'Save')}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#1e1e32] bg-[#0f0f1a] p-1">
        {[
          { key: 'active' as const, label: tx('Aktivni', 'Active'), count: activeOpomniki.length },
          { key: 'completed' as const, label: tx('Opravljeni', 'Completed'), count: completedOpomniki.length },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPogled(item.key)}
            className={`rounded-xl px-3 py-2 text-sm font-black transition-all ${
              pogled === item.key
                ? 'bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff33]'
                : 'text-[#8a8aa8] hover:bg-[#151524] hover:text-white'
            }`}
          >
            {item.label} <span className="ml-1 opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {/* Seznam opomnikov */}
      {seznamZaPrikaz.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {seznamZaPrikaz.map((op) => {
            const items = Array.isArray(op.items) ? op.items : [op]
            const jePaket = items.length > 1
            const dni = dniDo(op.datum)
            const preostaloKm = op.km_opomnik ? kmDo(op.km_opomnik) : null
            const b = pogled === 'completed'
              ? { text: 'text-[#22c55e]', bg: 'bg-[#22c55e11]', border: 'border-[#22c55e44]' }
              : skupnaBarva(dni, preostaloKm)

            return (
              <div key={op.id} className={`${b.bg} border ${b.border} rounded-2xl p-4`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tipIkona[op.tip] || '🔔'}</span>
                    <div>
                      <p className="text-white font-semibold">{tipNaziv[op.tip] || op.tip}</p>
                      {jePaket && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {items.map((item: any) => (
                            <span key={item.id} className="rounded-lg border border-[#3ecfcf44] bg-[#3ecfcf11] px-2 py-1 text-[10px] font-black text-[#3ecfcf]">
                              {tipNaziv[item.tip] || item.tip}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[#3a3a5a] text-xs mt-0.5">{tx('opozori', 'alert')} {op.opozorilo_dni_prej} {tx('dni prej', 'days before')}</p>
                      {pogled === 'completed' && (
                        <p className="mt-1 text-xs font-black text-[#22c55e]">{tx('Opravljeno', 'Completed')}: {op.completed_at ? new Date(op.completed_at).toLocaleDateString(locale) : '-'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {pogled === 'active' ? (
                      <>
                        <button onClick={() => oznaciOpomnikeOpravljeno(items.map((item: any) => item.id))}
                          className="rounded-xl border border-[#22c55e66] bg-[#22c55e18] px-3 py-2 text-xs font-black text-[#86efac] hover:bg-[#22c55e2a] transition-colors">
                          ✓ {tx('Opravljeno', 'Done')}
                        </button>
                        <button onClick={() => izbrisiOpomnike(items.map((item: any) => item.id))}
                          className="rounded-xl border border-[#ef444433] bg-[#ef444422] px-3 py-2 text-xs font-black text-[#ef4444] hover:bg-[#ef444444] transition-colors">
                          {tx('Izbriši', 'Delete')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => obnoviOpomnike(items.map((item: any) => item.id))}
                          className="rounded-xl border border-[#6c63ff66] bg-[#6c63ff22] px-3 py-2 text-xs font-black text-[#c8c4ff] hover:bg-[#6c63ff33] transition-colors">
                          {tx('Obnovi', 'Restore')}
                        </button>
                        <button onClick={() => arhivirajOpomnike(items.map((item: any) => item.id))}
                          className="rounded-xl border border-[#5a5a8044] bg-[#13131f] px-3 py-2 text-xs font-black text-[#8a8aa8] hover:text-white transition-colors">
                          {tx('Arhiviraj', 'Archive')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Datumski prikaz */}
                {op.datum && (
                  <div className={`mt-3 flex justify-between items-center p-3 rounded-xl ${barvaZaDni(dni).bg} border ${barvaZaDni(dni).border}`}>
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider">📅 {tx('Datum poteka', 'Due date')}</p>
                      <p className="text-white text-sm font-semibold mt-0.5">{new Date(op.datum).toLocaleDateString(locale)}</p>
                    </div>
                    {dni !== null && (
                      <div className="text-right">
                        {dni >= 0 ? (
                          <>
                            <p className={`${barvaZaDni(dni).text} font-bold text-2xl leading-none`}>{dni}</p>
                            <p className="text-[#5a5a80] text-xs">{tx('dni', 'days')}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[#ef4444] font-bold text-2xl leading-none">+{Math.abs(dni)}</p>
                            <p className="text-[#ef4444] text-xs">{tx('dni zamude', 'days overdue')}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Km prikaz */}
                {op.km_opomnik && preostaloKm !== null && (
                  <div className={`mt-2 flex justify-between items-center p-3 rounded-xl ${barvaZaKm(preostaloKm).bg} border ${barvaZaKm(preostaloKm).border}`}>
                    <div>
                      <p className="text-[#5a5a80] text-xs uppercase tracking-wider">🛣️ {tx('Km opomnik', 'Mileage reminder')}</p>
                      <p className="text-white text-sm font-semibold mt-0.5">{tx('pri', 'at')} {op.km_opomnik.toLocaleString(locale)} km</p>
                    </div>
                    <div className="text-right">
                      {preostaloKm >= 0 ? (
                        <>
                          <p className={`${barvaZaKm(preostaloKm).text} font-bold text-2xl leading-none`}>{preostaloKm.toLocaleString(locale)}</p>
                          <p className="text-[#5a5a80] text-xs">{tx('km še', 'km left')}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[#ef4444] font-bold text-2xl leading-none">+{Math.abs(preostaloKm).toLocaleString(locale)}</p>
                          <p className="text-[#ef4444] text-xs">{tx('km prekoračeno', 'km overdue')}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {op.datum && (
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 items-center">
                    <select
                      value={koledarPrioritete[op.id] || '5'}
                      onChange={(e) => setKoledarPrioritete(prev => ({ ...prev, [op.id]: e.target.value }))}
                      className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] text-xs rounded-xl px-3 py-2 outline-none focus:border-[#6c63ff]">
                      <option value="9">{tx('Nizka prioriteta', 'Low priority')}</option>
                      <option value="5">{tx('Srednja prioriteta', 'Medium priority')}</option>
                      <option value="1">{tx('Visoka prioriteta', 'High priority')}</option>
                    </select>
                    <button onClick={() => prenesiKoledar(op)}
                      className="bg-[#6c63ff22] border border-[#6c63ff66] text-[#a09aff] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-[#6c63ff33] transition-colors">
                      {tx('Koledar', 'Calendar')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Forma */}
      {false && showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-5 mb-4 flex flex-col gap-4">
          <h2 className="text-white font-semibold">{tx('Dodaj opomnik', 'Add reminder')}</h2>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-3 block">{tx('Tip', 'Type')}</label>
            <div className="grid grid-cols-4 gap-2">
              {tipi.map((t) => (
                <button key={t.vrednost} type="button"
                  onClick={() => setTip(t.vrednost)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                    tip === t.vrednost
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  <span className="text-lg">{t.ikona}</span>
                  <span className="text-[8px] uppercase tracking-wider text-center leading-tight">{tipNaziv[t.vrednost] || t.naziv}</span>
                </button>
              ))}
            </div>
          </div>

          {tip === 'custom' && (
            <div>
              <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Naziv opomnika', 'Reminder name')} *</label>
              <input type="text" value={tipCustom} onChange={e => setTipCustom(e.target.value)}
                placeholder={tx('npr. Menjava žarnic...', 'e.g. Bulb replacement...')}
                className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            </div>
          )}

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Datum poteka', 'Due date')}</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">
              {tx('Km opomnik', 'Mileage reminder')} <span className="text-[#3a3a5a] normal-case">({tx('trenutni', 'current')}: {avto?.km_trenutni?.toLocaleString(locale)} km)</span>
            </label>
            <input type="number" value={kmOpomnik} onChange={e => setKmOpomnik(e.target.value)}
              placeholder={`${tx('npr.', 'e.g.')} ${(avto?.km_trenutni || 0) + 15000}`}
              className="w-full bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
          </div>

          {['registracija', 'tehnicni', 'zavarovanje'].includes(tip) && datum && (
            <label className="flex items-start gap-3 rounded-2xl border border-[#3ecfcf55] bg-[#3ecfcf12] p-3 text-sm font-semibold text-[#d8ffff]">
              <input
                type="checkbox"
                checked={paketLetniDokumenti}
                onChange={(e) => setPaketLetniDokumenti(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#3ecfcf]"
              />
              <span>{tx('Dodaj skupaj registracijo, tehnični pregled in zavarovanje za isti datum.', 'Add registration, technical inspection and insurance together for the same date.')}</span>
            </label>
          )}

          <div>
            <label className="text-[#5a5a80] text-xs uppercase tracking-wider mb-2 block">{tx('Opozori X dni prej', 'Alert X days before')}</label>
            <div className="grid grid-cols-5 gap-2">
              {['7', '14', '30', '60', 'custom'].map((d) => (
                <button key={d} type="button"
                  onClick={() => setOpozoriloDni(d)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    opozoriloDni === d
                      ? 'bg-[#6c63ff22] border-[#6c63ff66] text-[#a09aff]'
                      : 'bg-[#13131f] border-[#1e1e32] text-[#5a5a80] hover:border-[#6c63ff33]'
                  }`}>
                  {d === 'custom' ? '✏️' : d}
                </button>
              ))}
            </div>
            {opozoriloDni === 'custom' && (
              <input type="number" value={opozoriloDniCustom} onChange={e => setOpozoriloDniCustom(e.target.value)}
                placeholder={tx('npr. 45', 'e.g. 45')}
                className="w-full mt-2 bg-[#13131f] border border-[#1e1e32] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#6c63ff] transition-colors" />
            )}
          </div>

          {message && <div className="p-3 rounded-xl text-sm border bg-[#ef444422] border-[#ef444444] text-[#fca5a5]">{message}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setShowForm(false); setMessage('') }}
              className="bg-[#13131f] border border-[#1e1e32] text-[#5a5a80] py-3 rounded-xl text-sm">
              {tx('Prekliči', 'Cancel')}
            </button>
            <button onClick={shrani} disabled={saving}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm">
              {saving ? tx('Shranjujem...', 'Saving...') : tx('Shrani', 'Save')}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-3 rounded-xl transition-colors">
          + {tx('Dodaj opomnik', 'Add reminder')}
        </button>
      )}

      {seznamZaPrikaz.length === 0 && !showForm && (
        <div className="bg-[#0f0f1a] border border-[#1e1e32] rounded-2xl p-6 text-center mt-4">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-white font-semibold mb-1">{pogled === 'active' ? tx('Ni aktivnih opomnikov', 'No active reminders') : tx('Ni opravljenih opomnikov', 'No completed reminders')}</p>
          <p className="text-[#5a5a80] text-sm">{pogled === 'active' ? tx('Dodaj registracijo, vinjeto ali drug opomnik', 'Add registration, vignette or another reminder') : tx('Opravljeni opomniki se prikažejo tukaj.', 'Completed reminders are shown here.')}</p>
        </div>
      )}

      </div>
      <HomeButton />
    </div>
  )
}
