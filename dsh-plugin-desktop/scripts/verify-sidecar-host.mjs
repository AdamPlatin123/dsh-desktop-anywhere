/** Headless smoke for the compatibility Host used by the Tauri spike. */

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { initProfile, PROFILE_TEMPLATES } from '@deepseek-ai/dsh-app-boot'

const sidecarPath = fileURLToPath(new URL('../lib/sidecar.js', import.meta.url))

async function verifySidecar(homeDir, profileName, inspect) {
  const child = spawn(process.execPath, [sidecarPath, '--profile', profileName], {
    env: { ...process.env, DSH_HOME: homeDir },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-16 * 1024) })
  const lines = createInterface({ input: child.stdout })
  const timeout = setTimeout(() => { child.kill() }, 15_000)
  const ready = await new Promise((resolve, reject) => {
    lines.on('line', (line) => {
      try {
        const event = JSON.parse(line)
        if (event.protocol === 1 && event.type === 'ready') resolve(event)
      } catch (cause) {
        reject(new Error(`sidecar emitted invalid JSON: ${line}`, { cause }))
      }
    })
    child.once('error', reject)
    child.once('exit', code => reject(new Error(
      `sidecar exited with ${String(code)} before ready${stderr === '' ? '' : `: ${stderr}`}`,
    )))
  })

  try {
    const response = await fetch(ready.url)
    const html = await response.text()
    if (response.status !== 200) {
      throw new Error(`sidecar Web root returned HTTP ${String(response.status)}`)
    }
    if (!html.includes('window.__DSH_BOOT__')) {
      throw new Error('sidecar Web root is missing window.__DSH_BOOT__')
    }
    inspect(html)
    child.stdin.end('{"protocol":1,"type":"shutdown"}\n')
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
    if (exitCode !== 0) throw new Error(`sidecar exited with ${String(exitCode)}: ${stderr}`)
  } finally {
    clearTimeout(timeout)
    lines.close()
    if (child.exitCode === null) child.kill()
  }

  try {
    await fetch(ready.url)
    throw new Error('sidecar Web root remained reachable after disposal')
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'sidecar Web root remained reachable after disposal') throw cause
  }
}

const defaultHome = mkdtempSync(join(tmpdir(), 'dsh-tauri-sidecar-default-'))
try {
  await verifySidecar(defaultHome, 'desktop', () => {})
} finally {
  rmSync(defaultHome, { recursive: true, force: true })
}

const pluginHome = mkdtempSync(join(tmpdir(), 'dsh-tauri-sidecar-plugin-'))
const clientName = 'dsh-tauri-sidecar-smoke-client'
try {
  const bundles = PROFILE_TEMPLATES.web
  if (bundles === undefined) throw new Error('installed DSH has no Web profile template')
  const webDir = join(pluginHome, 'profiles', 'web')
  initProfile(webDir, bundles)
  const clientDir = join(webDir, 'node_modules', clientName)
  mkdirSync(clientDir, { recursive: true })
  writeFileSync(join(clientDir, 'package.json'), JSON.stringify({
    name: clientName,
    version: '0.0.0',
    type: 'module',
    exports: {
      '.': './index.js',
      './client': './client.js',
      './package.json': './package.json',
    },
    dsh: { client: { platform: 'web' } },
  }) + '\n')
  writeFileSync(join(clientDir, 'index.js'), 'export function apply() {}\n')
  writeFileSync(join(clientDir, 'client.js'), 'export function apply() {}\n')
  writeFileSync(join(pluginHome, 'cordis.patch.yml'), [
    '- insert:',
    `    - id: ${clientName}`,
    `      name: ${clientName}`,
    '',
  ].join('\n'))

  await verifySidecar(pluginHome, 'web', (html) => {
    const bootMatch = html.match(/window\.__DSH_BOOT__ = (\{.*?\})<\/script>/u)
    if (bootMatch?.[1] === undefined) throw new Error('sidecar Web root has no parseable boot manifest')
    const graph = JSON.parse(bootMatch[1])
    if (!graph.entries.some(entry => entry.id === clientName)) {
      throw new Error(
        `third-party Web Client is missing from the sidecar boot graph: ${graph.entries.map(entry => entry.id).join(', ')}`,
      )
    }
  })
} finally {
  rmSync(pluginHome, { recursive: true, force: true })
}

process.stdout.write('verify-sidecar-host: default and third-party Client carriers passed\n')
