const targets = [
  'https://getgaragebase.com',
  'https://www.getgaragebase.com',
  'https://getgaragebase.com/api/health',
  'https://www.getgaragebase.com/api/health',
]

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const timeoutMs = 15000

async function powershellCheck(url) {
  const script = `
    $ErrorActionPreference = 'Stop'
    $started = Get-Date
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri '${url.replaceAll("'", "''")}' -TimeoutSec ${Math.ceil(timeoutMs / 1000)}
      $ms = [int]((Get-Date) - $started).TotalMilliseconds
      $body = $response.Content
      $healthOk = $null
      $health = $null
      if ('${url.replaceAll("'", "''")}'.EndsWith('/api/health')) {
        try {
          $json = $body | ConvertFrom-Json
          $healthOk = ($json.ok -eq $true)
          $health = @{
            database = $json.database.status
            push = $json.push.status
            cron = $json.cron.status
            storage = $json.storage.status
          }
        } catch {
          $healthOk = $false
        }
      }
      @{
        url = '${url.replaceAll("'", "''")}'
        finalUrl = $response.BaseResponse.ResponseUri.AbsoluteUri
        status = [int]$response.StatusCode
        ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
        ms = $ms
        healthOk = $healthOk
        health = $health
      } | ConvertTo-Json -Compress -Depth 4
    } catch {
      @{
        url = '${url.replaceAll("'", "''")}'
        ok = $false
        error = $_.Exception.Message
      } | ConvertTo-Json -Compress -Depth 4
    }
  `

  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { timeout: timeoutMs + 5000 })
  return JSON.parse(stdout.trim())
}

async function checkTarget(url) {
  if (process.platform === 'win32') return powershellCheck(url)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'GarageBase production check' },
    })
    const ms = Date.now() - started
    const result = {
      url,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      ms,
    }

    if (url.endsWith('/api/health') && response.ok) {
      try {
        const health = await response.json()
        result.healthOk = health.ok === true
        result.health = {
          database: health.database?.status,
          push: health.push?.status,
          cron: health.cron?.status,
          storage: health.storage?.status,
        }
      } catch {
        result.healthOk = false
      }
    }

    return result
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

console.log('GarageBase production check')

const results = await Promise.all(targets.map(checkTarget))
let failed = false

for (const result of results) {
  const status = result.ok && result.healthOk !== false ? 'OK' : 'FAIL'
  const parts = [
    status,
    result.url,
    result.status ? `status ${result.status}` : null,
    result.ms ? `${result.ms}ms` : null,
    result.finalUrl && result.finalUrl !== result.url ? `-> ${result.finalUrl}` : null,
    result.error || null,
  ].filter(Boolean)

  console.log(parts.join(' | '))

  if (result.health) {
    console.log(`  health: db=${result.health.database} push=${result.health.push} cron=${result.health.cron} storage=${result.health.storage}`)
  }

  if (!result.ok || result.healthOk === false) failed = true
}

if (failed) {
  console.error('\nProduction check failed. Check Vercel domains, DNS and /api/health.')
  process.exit(1)
}

console.log('\nProduction check OK.')
