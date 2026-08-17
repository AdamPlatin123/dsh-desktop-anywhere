import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const packageRoot = resolve(import.meta.dirname, '..')
const runtimeRoot = resolve(packageRoot, '..', '.build', 'r')
const node = join(runtimeRoot, 'node.exe')
const sidecar = join(runtimeRoot, 'app', 'lib', 'sidecar.js')
const homeDir = await mkdtemp(join(tmpdir(), 'dsh-tauri-runtime-'))
const timeout = AbortSignal.timeout(60_000)
const child = spawn(node, [sidecar], {
  cwd: join(runtimeRoot, 'app'),
  env: {
    ...process.env,
    DSH_HOME: homeDir,
    NODE_PATH: '',
    Path: '',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.setEncoding('utf8')
child.stderr.on('data', chunk => { stderr += chunk })

try {
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
  const ready = await Promise.race([
    (async () => {
      for await (const line of lines) {
        const event = JSON.parse(line)
        if (event.protocol === 1 && event.type === 'ready') return event
      }
      throw new Error(`sidecar exited before ready: ${stderr}`)
    })(),
    new Promise((_, reject) => {
      timeout.addEventListener('abort', () => reject(new Error(`sidecar readiness timed out: ${stderr}`)))
    }),
  ])
  const url = new URL(ready.url)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') {
    throw new Error(`sidecar returned a non-loopback URL: ${ready.url}`)
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`renderer returned HTTP ${response.status}`)

  child.stdin.end('{"protocol":1,"type":"shutdown"}\n')
  const exit = await waitForExit(child, 15_000)
  if (exit.code !== 0) throw new Error(`sidecar exited with ${String(exit.code)}: ${stderr}`)
  console.log(`verify-tauri-runtime: bundled Node served ${ready.url} and exited cleanly.`)
} finally {
  if (child.exitCode === null) child.kill()
  await rm(homeDir, { recursive: true, force: true })
}

function waitForExit(process, milliseconds) {
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new Error('sidecar shutdown timed out')), milliseconds)
    process.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolveExit({ code, signal })
    })
    process.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}
