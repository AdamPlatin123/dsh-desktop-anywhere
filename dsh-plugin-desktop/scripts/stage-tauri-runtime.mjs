import { spawnSync } from 'node:child_process'
import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const packageRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(packageRoot, '..')
const buildRoot = join(workspaceRoot, '.build', 'tauri-runtime-workspace')
const runtimeRoot = join(workspaceRoot, '.build', 'r')
const bundleConfig = join(workspaceRoot, '.build', 'tauri-bundle.config.json')
const previousRuntimeRoot = join(packageRoot, '.tauri-runtime')
const legacyRuntimeRoot = join(packageRoot, 'spikes', 'tauri-sidecar', 'src-tauri', 'runtime')
const stagedPackageRoot = join(buildRoot, 'dsh-plugin-desktop')
const appRoot = join(runtimeRoot, 'app')

await resetGeneratedDirectory(buildRoot, join(workspaceRoot, '.build'))
await resetGeneratedDirectory(runtimeRoot, join(workspaceRoot, '.build'))
await removeGeneratedDirectory(previousRuntimeRoot, packageRoot)
await removeGeneratedDirectory(
  legacyRuntimeRoot,
  join(packageRoot, 'spikes', 'tauri-sidecar', 'src-tauri'),
)

await copyFile(join(workspaceRoot, 'package.json'), join(buildRoot, 'package.json'))
await copyFile(join(workspaceRoot, 'yarn.lock'), join(buildRoot, 'yarn.lock'))
await copyFile(join(workspaceRoot, '.yarnrc.yml'), join(buildRoot, '.yarnrc.yml'))
await cp(join(workspaceRoot, 'patches'), join(buildRoot, 'patches'), { recursive: true })

for (const workspace of ['dsh-plugin-desktop', 'dsh-community-fabric', 'dsh-community-market']) {
  await copyFile(
    join(workspaceRoot, workspace, 'package.json'),
    join(buildRoot, workspace, 'package.json'),
  )
}

const corepack = process.platform === 'win32'
  ? [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'corepack yarn workspaces focus dsh-plugin-desktop --production']]
  : ['corepack', ['yarn', 'workspaces', 'focus', 'dsh-plugin-desktop', '--production']]
const install = spawnSync(
  corepack[0],
  corepack[1],
  { cwd: buildRoot, encoding: 'utf8', stdio: 'inherit' },
)
if (install.error !== undefined) throw install.error
if (install.status !== 0) {
  throw new Error(`production runtime install exited with ${String(install.status)}`)
}

await mkdir(appRoot, { recursive: true })
await copyFile(join(packageRoot, 'package.json'), join(appRoot, 'package.json'))
await copyFile(join(packageRoot, 'cordis.patch.yml'), join(appRoot, 'cordis.patch.yml'))
await cp(join(packageRoot, 'build'), join(appRoot, 'build'), { recursive: true })
await cp(join(packageRoot, 'lib'), join(appRoot, 'lib'), { recursive: true })
await cp(join(stagedPackageRoot, 'node_modules'), join(appRoot, 'node_modules'), {
  dereference: true,
  recursive: true,
})

const rootNodeModules = join(buildRoot, 'node_modules')
if (await exists(rootNodeModules)) {
  await cp(rootNodeModules, join(appRoot, 'node_modules'), {
    dereference: true,
    recursive: true,
    force: false,
    filter: source => basename(source) !== 'dsh-plugin-desktop',
  })
}

const nodeSource = resolve(process.env.DSH_TAURI_NODE_SOURCE ?? process.execPath)
if (process.platform !== 'win32' || basename(nodeSource).toLowerCase() !== 'node.exe') {
  throw new Error(`Windows Node executable required for the NSIS runtime: ${nodeSource}`)
}
await copyFile(nodeSource, join(runtimeRoot, 'node.exe'))

const resourceNode = join(runtimeRoot, 'node.exe').replaceAll('\\', '/')
const resourceApp = `${appRoot.replaceAll('\\', '/')}/`
await writeFile(bundleConfig, `${JSON.stringify({
  bundle: {
    resources: {
      [resourceNode]: 'runtime/node.exe',
      [resourceApp]: 'runtime/app/',
    },
  },
}, null, 2)}\n`)

for (const required of [
  join(runtimeRoot, 'node.exe'),
  join(appRoot, 'lib', 'sidecar.js'),
  join(appRoot, 'cordis.patch.yml'),
  join(appRoot, 'node_modules', '@deepseek-ai', 'dsh-web-app', 'package.json'),
]) {
  if (!await exists(required)) throw new Error(`staged runtime is missing ${required}`)
}

const bytes = await directoryBytes(runtimeRoot)
console.log(`stage-tauri-runtime: staged ${(bytes / 1024 / 1024).toFixed(1)} MiB at ${runtimeRoot}`)
console.log(`stage-tauri-runtime: wrote Tauri resource overlay at ${bundleConfig}`)

async function copyFile(source, destination) {
  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination)
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (cause) {
    if (cause?.code === 'ENOENT') return false
    throw cause
  }
}

async function resetGeneratedDirectory(path, allowedParent) {
  const resolvedPath = resolve(path)
  const resolvedParent = resolve(allowedParent)
  if (dirname(resolvedPath) !== resolvedParent) {
    throw new Error(`refused to reset generated directory outside ${resolvedParent}: ${resolvedPath}`)
  }
  await rm(resolvedPath, { recursive: true, force: true })
  await mkdir(resolvedPath, { recursive: true })
}

async function removeGeneratedDirectory(path, allowedParent) {
  const resolvedPath = resolve(path)
  const resolvedParent = resolve(allowedParent)
  if (dirname(resolvedPath) !== resolvedParent) {
    throw new Error(`refused to remove generated directory outside ${resolvedParent}: ${resolvedPath}`)
  }
  await rm(resolvedPath, { recursive: true, force: true })
}

async function directoryBytes(path) {
  const { readdir } = await import('node:fs/promises')
  let total = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name)
    if (entry.isDirectory()) total += await directoryBytes(entryPath)
    else if (entry.isFile()) total += (await stat(entryPath)).size
  }
  return total
}
