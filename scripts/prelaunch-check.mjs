import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredFiles = [
  'public/manifest.json',
  'public/sw.js',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/notification-badge.png',
  'src/app/api/health/route.ts',
  'src/app/global-error.tsx',
  'RELEASE_CHECKLIST.md',
  'STAGING_IN_ROLLBACK.md',
]

const requiredEnvKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

const recommendedEnvKeys = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'VAPID_EMAIL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
]

const textRoots = ['src/app', 'src/lib']
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const dataApiGrantFile = 'SUPABASE_MIGRACIJA_DATA_API_GRANTS.sql'
const mojibakePatterns = [/�/, /Ä/, /Ĺ/, /â/, /đź/, /Ĺˇ/, /ÄŤ/]

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/)
  return match ? match[0] : ''
}

function walk(dir, output = []) {
  const absolute = join(root, dir)
  if (!existsSync(absolute)) return output

  for (const name of readdirSync(absolute)) {
    const relative = join(dir, name).replaceAll('\\', '/')
    const full = join(root, relative)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(relative, output)
    } else if (textExtensions.has(extensionOf(relative))) {
      output.push(relative)
    }
  }

  return output
}

function parseEnvFile() {
  const envPath = join(root, '.env.local')
  if (!existsSync(envPath)) return new Set()

  const env = new Set()
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    env.add(trimmed.split('=')[0].trim())
  }
  return env
}

const missingFiles = requiredFiles.filter((file) => !existsSync(join(root, file)))
const localEnvKeys = parseEnvFile()
const missingRequiredEnv = requiredEnvKeys.filter((key) => !localEnvKeys.has(key) && !process.env[key])
const missingRecommendedEnv = recommendedEnvKeys.filter((key) => !localEnvKeys.has(key) && !process.env[key])

const suspiciousText = []
for (const file of textRoots.flatMap((dir) => walk(dir))) {
  const text = readFileSync(join(root, file), 'utf8')
  const hasSuspiciousText = mojibakePatterns.some((pattern) => pattern.test(text))
  if (hasSuspiciousText) suspiciousText.push(file)
}

const sqlFiles = readdirSync(root).filter((name) => name.toLowerCase().endsWith('.sql'))
const createdPublicTables = new Set()
for (const file of sqlFiles) {
  const text = readFileSync(join(root, file), 'utf8')
  for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)) {
    createdPublicTables.add(match[1])
  }
}

const grantFileText = existsSync(join(root, dataApiGrantFile))
  ? readFileSync(join(root, dataApiGrantFile), 'utf8')
  : ''
const missingDataApiGrants = [...createdPublicTables].filter((table) => {
  const tablePattern = new RegExp(`['"]${table}['"]`, 'i')
  return !tablePattern.test(grantFileText)
})

console.log('GarageBase prelaunch check')

if (missingFiles.length) {
  console.error('\nMissing required files:')
  for (const file of missingFiles) console.error(`- ${file}`)
}

if (missingRequiredEnv.length) {
  console.error('\nMissing required env keys in .env.local or process env:')
  for (const key of missingRequiredEnv) console.error(`- ${key}`)
}

if (missingRecommendedEnv.length) {
  console.warn('\nRecommended env keys not found locally:')
  for (const key of missingRecommendedEnv) console.warn(`- ${key}`)
}

if (suspiciousText.length) {
  console.warn('\nPossible broken text encoding found. Review these files first:')
  for (const file of suspiciousText.slice(0, 20)) console.warn(`- ${file}`)
  if (suspiciousText.length > 20) console.warn(`- ...and ${suspiciousText.length - 20} more`)
}

if (!grantFileText) {
  console.error(`\nMissing Supabase Data API grant file: ${dataApiGrantFile}`)
}

if (missingDataApiGrants.length) {
  console.error('\nPublic tables created in SQL migrations but missing from Data API grants:')
  for (const table of missingDataApiGrants) console.error(`- public.${table}`)
}

if (missingFiles.length || missingRequiredEnv.length || !grantFileText || missingDataApiGrants.length) {
  console.error('\nPrelaunch check failed.')
  process.exit(1)
}

console.log('\nPrelaunch check OK. Warnings above are not blocking, but should be reviewed.')
