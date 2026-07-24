'use client'

import { supabase } from '@/lib/supabase'
import { clearVehicleDataCaches } from '@/lib/vehicle-cache'

const DB_NAME = 'garagebase-offline'
const DB_VERSION = 1
const STORE_NAME = 'queue'

export type OfflineQueueType = 'fuel' | 'service' | 'expense'
export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed'

export type OfflineQueueItem = {
  id: string
  type: OfflineQueueType
  userId: string
  carId: string
  payload: Record<string, unknown>
  createdAt: string
  status: OfflineQueueStatus
  attempts: number
  lastError?: string
}

type QueueEventDetail = {
  pending: number
  failed: number
  syncing: boolean
  lastMessage?: string
}

const eventName = 'garagebase-offline-queue'

const canUseIndexedDb = () => typeof window !== 'undefined' && 'indexedDB' in window

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is not available.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error || new Error('Could not open offline database.'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('userId', 'userId', { unique: false })
      }
    }
  })
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    let request: IDBRequest<T> | void
    tx.oncomplete = () => {
      db.close()
      resolve(request ? request.result : undefined)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error('Offline database transaction failed.'))
    }
    request = callback(store)
  })
}

export function isOfflineNow() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function createOfflineId(type: OfflineQueueType) {
  const cryptoId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${type}_${cryptoId}`
}

export async function enqueueOfflineItem(input: Omit<OfflineQueueItem, 'createdAt' | 'status' | 'attempts'>) {
  const item: OfflineQueueItem = {
    ...input,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  }
  await withStore('readwrite', (store) => store.put(item))
  await emitOfflineQueueState('queued')
  return item
}

export async function getOfflineQueueItems() {
  const items = await withStore<OfflineQueueItem[]>('readonly', (store) => store.getAll())
  return (items || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function updateOfflineItem(item: OfflineQueueItem) {
  await withStore('readwrite', (store) => store.put(item))
}

async function deleteOfflineItem(id: string) {
  await withStore('readwrite', (store) => store.delete(id))
}

export async function offlineQueueCounts() {
  const items = await getOfflineQueueItems().catch(() => [])
  return {
    pending: items.filter((item) => item.status === 'pending' || item.status === 'syncing').length,
    failed: items.filter((item) => item.status === 'failed').length,
  }
}

export async function emitOfflineQueueState(lastMessage?: string, syncing = false) {
  if (typeof window === 'undefined') return
  const counts = await offlineQueueCounts()
  window.dispatchEvent(new CustomEvent<QueueEventDetail>(eventName, {
    detail: { ...counts, syncing, lastMessage },
  }))
}

export function subscribeOfflineQueue(listener: (detail: QueueEventDetail) => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => listener((event as CustomEvent<QueueEventDetail>).detail)
  window.addEventListener(eventName, handler)
  void emitOfflineQueueState()
  return () => window.removeEventListener(eventName, handler)
}

const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function syncFuel(item: OfflineQueueItem) {
  const payload = item.payload
  const { error } = await supabase.from('fuel_logs').insert({
    car_id: item.carId,
    datum: payload.datum,
    km: payload.km,
    litri: payload.litri,
    cena_na_liter: payload.cena_na_liter ?? null,
    cena_skupaj: payload.cena_skupaj ?? null,
    polni_rezervar: payload.polni_rezervar,
    postaja: payload.postaja ?? null,
    tip_goriva: payload.tip_goriva ?? null,
  })
  if (error) throw error
  await supabase.from('cars').update({ km_trenutni: Math.max(numberValue(payload.currentKm), numberValue(payload.km)) }).eq('id', item.carId).eq('user_id', item.userId)
}

async function syncService(item: OfflineQueueItem) {
  const payload = item.payload
  const { error } = await supabase.from('service_logs').insert({
    car_id: item.carId,
    datum: payload.datum,
    km: payload.km,
    opis: payload.opis,
    servis: payload.servis || null,
    cena: payload.cena ?? null,
  })
  if (error) throw error
  await supabase.from('cars').update({ km_trenutni: Math.max(numberValue(payload.currentKm), numberValue(payload.km)) }).eq('id', item.carId).eq('user_id', item.userId)

  if (payload.reminderDate || payload.reminderKm) {
    await supabase.from('reminders').insert({
      car_id: item.carId,
      tip: 'servis',
      datum: payload.reminderDate || null,
      km_opomnik: payload.reminderKm || null,
      opozorilo_dni_prej: 30,
    })
  }
}

async function syncExpense(item: OfflineQueueItem) {
  const payload = item.payload
  const { error } = await supabase.from('expenses').insert({
    car_id: item.carId,
    datum: payload.datum,
    znesek: payload.znesek,
    kategorija: payload.kategorija,
    opis: payload.opis || null,
  })
  if (error) throw error
}

async function syncItem(item: OfflineQueueItem) {
  if (item.type === 'fuel') await syncFuel(item)
  else if (item.type === 'service') await syncService(item)
  else if (item.type === 'expense') await syncExpense(item)
  clearVehicleDataCaches(item.carId)
}

let syncInFlight = false

export async function syncOfflineQueue() {
  if (syncInFlight || isOfflineNow()) {
    await emitOfflineQueueState(undefined, syncInFlight)
    return { synced: 0, failed: 0 }
  }

  syncInFlight = true
  await emitOfflineQueueState('syncing', true)
  let synced = 0
  let failed = 0

  try {
    const items = await getOfflineQueueItems()
    for (const item of items) {
      if (item.status === 'syncing') item.status = 'pending'
      if (item.status !== 'pending' && item.status !== 'failed') continue

      const syncingItem: OfflineQueueItem = { ...item, status: 'syncing', attempts: item.attempts + 1, lastError: undefined }
      await updateOfflineItem(syncingItem)

      try {
        await syncItem(syncingItem)
        await deleteOfflineItem(syncingItem.id)
        synced++
      } catch (error: unknown) {
        failed++
        await updateOfflineItem({
          ...syncingItem,
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'sync_failed',
        })
      }
    }
  } finally {
    syncInFlight = false
    await emitOfflineQueueState(synced > 0 ? 'synced' : undefined, false)
  }

  return { synced, failed }
}
