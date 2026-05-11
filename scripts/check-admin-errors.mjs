import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()

function loadLocalEnv() {
  const envPath = join(root, '.env.local')
  if (!existsSync(envPath)) return

  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...valueParts] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = valueParts.join('=')
  }
}

function sinceIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function formatItem(item) {
  const title = item.error_name || item.title || item.event_name || 'unknown'
  const page = item.page_path || item.page_url || '-'
  const message = item.message || item.description || ''
  return `${item.created_at || item.updated_at || ''} | ${title} | ${page}${message ? ` | ${String(message).slice(0, 140)}` : ''}`
}

loadLocalEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const hours = Number(process.argv.find((arg) => arg.startsWith('--hours='))?.split('=')[1] || 24)

console.log(`GarageBase admin monitor (${hours}h)`)

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Set them in .env.local or the shell environment to read recent admin errors.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const since = sinceIso(hours)

const [errorsRes, bugsRes] = await Promise.all([
  supabase
    .from('app_errors')
    .select('created_at,error_name,page_path,message,status,release_channel,app_version')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20),
  supabase
    .from('bug_reports')
    .select('created_at,title,page_url,description,status,priority')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20),
])

if (errorsRes.error) {
  console.error(`Could not read app_errors: ${errorsRes.error.message}`)
  process.exit(1)
}

if (bugsRes.error) {
  console.error(`Could not read bug_reports: ${bugsRes.error.message}`)
  process.exit(1)
}

const errors = errorsRes.data || []
const bugs = bugsRes.data || []
const openErrors = errors.filter((item) => item.status !== 'resolved')
const openBugs = bugs.filter((item) => item.status !== 'done' && item.status !== 'resolved')

console.log(`app_errors: ${errors.length} recent, ${openErrors.length} open`)
for (const item of openErrors.slice(0, 8)) console.log(`- ${formatItem(item)}`)

console.log(`bug_reports: ${bugs.length} recent, ${openBugs.length} open`)
for (const item of openBugs.slice(0, 8)) console.log(`- ${formatItem(item)}`)

if (openErrors.length || openBugs.length) {
  console.warn('\nReview recent open issues before deploy.')
  process.exitCode = 1
} else {
  console.log('\nAdmin monitor OK.')
}
