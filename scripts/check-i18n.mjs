import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const textRoots = ['src/app', 'src/lib']
const textExtensions = new Set(['.ts', '.tsx'])

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

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length
}

function readQuoted(text, start) {
  const quote = text[start]
  if (!['"', "'", '`'].includes(quote)) return null
  let value = ''
  let escaped = false
  for (let index = start + 1; index < text.length; index++) {
    const char = text[index]
    if (escaped) {
      value += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === quote) {
      return { value, end: index + 1, quote }
    }
    value += char
  }
  return null
}

function skipSpaces(text, index) {
  while (index < text.length && /\s/.test(text[index])) index++
  return index
}

function extractTxCalls(text) {
  const calls = []
  const pattern = /\btx\s*\(/g
  let match
  while ((match = pattern.exec(text))) {
    let index = skipSpaces(text, pattern.lastIndex)
    const sl = readQuoted(text, index)
    if (!sl) continue
    index = skipSpaces(text, sl.end)
    if (text[index] !== ',') continue
    index = skipSpaces(text, index + 1)
    const en = readQuoted(text, index)
    if (!en) continue
    calls.push({ start: match.index, sl: sl.value, en: en.value })
  }
  return calls
}

function normalize(value) {
  return value.replace(/\$\{[^}]+\}/g, '${}').replace(/\s+/g, ' ').trim().toLowerCase()
}

function hasLetters(value) {
  return /[A-Za-zA-ZČŠŽĆĐčšžćđ]/.test(value)
}

function isPlaceholder(value) {
  return /^(todo|tbd|fixme|prevedi|translate|translation)$/i.test(value.trim())
}

const failures = []
const warnings = []

for (const file of textRoots.flatMap((dir) => walk(dir))) {
  const text = readFileSync(join(root, file), 'utf8')
  for (const call of extractTxCalls(text)) {
    const line = lineForOffset(text, call.start)
    const location = `${file}:${line}`
    const sl = call.sl.trim()
    const en = call.en.trim()

    if (!sl || !en) {
      failures.push(`${location} tx() needs both Slovenian and English text.`)
      continue
    }

    if (isPlaceholder(sl) || isPlaceholder(en)) {
      failures.push(`${location} tx() contains a placeholder translation.`)
      continue
    }

    if (hasLetters(sl) && normalize(sl) === normalize(en)) {
      warnings.push(`${location} tx() has identical Slovenian and English text: "${sl}"`)
    }
  }
}

console.log('GarageBase i18n check')

if (warnings.length) {
  console.warn('\nReview identical tx() strings:')
  for (const warning of warnings.slice(0, 30)) console.warn(`- ${warning}`)
  if (warnings.length > 30) console.warn(`- ...and ${warnings.length - 30} more`)
}

if (failures.length) {
  console.error('\nMissing or invalid translations:')
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('\nI18n check failed.')
  process.exit(1)
}

console.log('\nI18n check OK.')
