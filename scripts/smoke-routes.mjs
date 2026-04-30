import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredPaths = [
  'src/app/login/page.tsx',
  'src/app/garaza/page.tsx',
  'src/app/dodaj-avto/page.tsx',
  'src/app/vnos-goriva/page.tsx',
  'src/app/vnos-servisa/page.tsx',
  'src/app/vnos-stroska/page.tsx',
  'src/app/report/page.tsx',
  'src/app/scan/page.tsx',
  'src/app/nastavitve/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin-napake/page.tsx',
  'src/app/prijava-napake/page.tsx',
  'src/app/api/cron/route.ts',
  'src/app/api/push/route.ts',
  'src/app/api/delete-account/route.ts',
  'SUPABASE_MIGRACIJA_ADMIN_FEEDBACK.sql',
  'SUPABASE_MIGRACIJA_BUG_REPORTS.sql',
  'SUPABASE_MIGRACIJA_ERROR_LOGGING.sql',
]

const missing = requiredPaths.filter((file) => !existsSync(join(root, file)))

if (missing.length) {
  console.error('GarageBase smoke check failed. Missing files:')
  for (const file of missing) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`GarageBase smoke check OK. Checked ${requiredPaths.length} critical files.`)
